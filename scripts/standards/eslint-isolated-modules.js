import { posix, relative, sep } from "node:path";

const EVENT = "CanonicalEvent";
const GLOB_DIRECTORY = /[*?[\]{}()!+@]/;

const nameOf = (node) => node?.name ?? node?.value;

const named = (node) =>
  nameOf(node?.type === "TSQualifiedName" ? node.right : node) === EVENT && node.type !== "Literal";

function mentions(node) {
  if (named(node)) return true;
  return Object.entries(node).some(([key, child]) => {
    if (key === "parent" || (key === "key" && /Signature$/.test(node.type))) return false;
    const children = Array.isArray(child) ? child : [child];
    return children.some((item) => typeof item?.type === "string" && mentions(item));
  });
}

function exposes(node) {
  switch (node.type) {
    case "TSTypeLiteral":
    case "TSFunctionType":
    case "TSConstructorType":
    case "TSTypeQuery":
      return false;
    case "TSTypeReference":
      return named(node.typeName) || mentions(node);
    case "TSImportType":
      return named(node.qualifier) || mentions(node);
    case "TSUnionType":
    case "TSIntersectionType":
      return node.types.some(exposes);
    case "TSTupleType":
      return node.elementTypes.some(exposes);
    case "TSArrayType":
    case "TSNamedTupleMember":
      return exposes(node.elementType);
    case "TSOptionalType":
    case "TSRestType":
      return exposes(node.typeAnnotation);
    case "TSTypeOperator":
      return node.operator !== "keyof" && exposes(node.typeAnnotation);
    case "TSIndexedAccessType":
      return node.objectType.type === "TSTypeReference" && named(node.objectType.typeName)
        ? mentions(node.indexType)
        : mentions(node);
    default:
      return mentions(node);
  }
}

const canonicalEvent = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      assertion:
        "Build a CanonicalEvent with the functions in src/events, never with a type assertion.",
      renamed: "Use CanonicalEvent under its own name so the type assertion ban can see it.",
    },
  },
  create(context) {
    const check = (node, bad, messageId) => bad && context.report({ node, messageId });
    const assertion = (node) => check(node, mentions(node.typeAnnotation), "assertion");
    return {
      TSAsExpression: assertion,
      TSTypeAssertion: assertion,
      ImportSpecifier: (node) =>
        check(node, nameOf(node.imported) === EVENT && nameOf(node.local) !== EVENT, "renamed"),
      ExportSpecifier: (node) =>
        check(node, nameOf(node.local) === EVENT && nameOf(node.exported) !== EVENT, "renamed"),
      TSTypeAliasDeclaration: (node) =>
        check(
          node,
          exposes(node.typeAnnotation) || (node.typeParameters && mentions(node.typeParameters)),
          "renamed",
        ),
      TSImportEqualsDeclaration: (node) =>
        check(node, named(node.moduleReference) && nameOf(node.id) !== EVENT, "renamed"),
      TSInterfaceHeritage: (node) => check(node, mentions(node), "renamed"),
    };
  },
};

function target(specifier, importer) {
  if (specifier.startsWith("@/")) return posix.join("src", specifier.slice(2));
  if (specifier.startsWith("/")) return posix.normalize(specifier.slice(1));
  if (specifier.startsWith(".")) return posix.join(posix.dirname(importer), specifier);
  return undefined;
}

function outsideOwner(specifier, importer) {
  const segments = target(specifier, importer)?.split("/") ?? [];
  const index = segments.lastIndexOf("internal");
  return index > 0 && !importer.startsWith(`${segments.slice(0, index).join("/")}/`);
}

const isString = (node) => node?.type === "Literal" && typeof node.value === "string";

const plainOptions = (node) =>
  node === undefined ||
  (node.type === "ObjectExpression" &&
    node.properties.every(
      (property) =>
        property.type === "Property" && !property.computed && nameOf(property.key) !== "base",
    ));

const internalImports = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      internal:
        "Import from src/events (or whichever module owns this internal/ folder), not from its internal/ files.",
      computed:
        "Load modules by plain string paths with no wildcard directories so the internal/ fence can check them.",
    },
  },
  create(context) {
    const importer = relative(context.cwd, context.filename).split(sep).join("/");
    const fence = (node, specifier) =>
      outsideOwner(specifier.split(/[?#]/)[0], importer) &&
      context.report({ node, messageId: "internal" });
    const computed = (node) => context.report({ node, messageId: "computed" });
    const load = (node) => (isString(node) ? fence(node, node.value) : computed(node));
    const glob = (node) => {
      const [patterns, options] = node.arguments;
      const list = patterns?.type === "ArrayExpression" ? patterns.elements : [patterns];
      if (!plainOptions(options) || !list.every(isString)) return computed(node);
      for (const pattern of list) {
        const path = pattern.value.replace(/^!/, "");
        const directory = path.slice(path.startsWith("@/") ? 2 : 0, path.lastIndexOf("/") + 1);
        if (GLOB_DIRECTORY.test(directory) || path.includes("**")) computed(pattern);
        else fence(pattern, path);
      }
    };
    const literal = (node) => node.source && fence(node.source, node.source.value);
    return {
      ImportDeclaration: literal,
      ExportNamedDeclaration: literal,
      ExportAllDeclaration: literal,
      TSImportType: literal,
      TSExternalModuleReference: (node) => fence(node.expression, node.expression.value),
      ImportExpression: (node) => load(node.source),
      CallExpression(node) {
        const { callee } = node;
        const member = callee.type === "MemberExpression" && !callee.computed;
        if (member && callee.object.meta?.name === "import" && callee.property.name === "glob")
          glob(node);
        else if (
          (callee.type === "Identifier" && callee.name === "require") ||
          (member && callee.object.name === "module" && callee.property.name === "require")
        )
          load(node.arguments[0]);
      },
    };
  },
};

export default {
  rules: { "canonical-event": canonicalEvent, "internal-imports": internalImports },
};
