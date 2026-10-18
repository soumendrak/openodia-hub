import { posix, relative, resolve, sep } from "node:path";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

type Node = TSESTree.Node;

type Context<Message> = {
  readonly filename: string;
  report(descriptor: { node: Node; messageId: Message }): void;
};

const ROOT = resolve(import.meta.dirname, "../..");
const MODULE = "src/events";
const TESTS = "test/events";
const GLOB_DIRECTORY = /[*?[\]{}()!+@]/;

const fromRoot = (file: string) => relative(ROOT, file).split(sep).join("/");

const isNode = (value: unknown): value is Node =>
  typeof value === "object" && value !== null && "type" in value && typeof value.type === "string";

const nameOf = (node: Node | null | undefined) =>
  node?.type === "Identifier" ? node.name : node?.type === "Literal" ? String(node.value) : "";

function target(specifier: string, importer: string) {
  if (specifier.startsWith("@/")) return posix.join("src", specifier.slice(2));
  if (specifier.startsWith("/")) return posix.normalize(specifier.slice(1));
  if (specifier.startsWith(".")) return posix.join(posix.dirname(importer), specifier);
  return undefined;
}

function decoded(path: string) {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

const resolved = (specifier: string, importer: string) =>
  target(decoded(specifier.split(/[?#]/)[0] ?? "").replaceAll("\\", "/"), importer) ?? "";

function outsideOwner(specifier: string, importer: string) {
  const segments = resolved(specifier, importer).split("/");
  const index = segments.lastIndexOf("internal");
  return index > 0 && !importer.startsWith(`${segments.slice(0, index).join("/")}/`);
}

const label = (parent: Node, key: string) =>
  key === "parent" ||
  (key === "key" && "computed" in parent && !parent.computed) ||
  (key === "property" && parent.type === "MemberExpression" && !parent.computed) ||
  (key === "right" && parent.type === "TSQualifiedName");

function children(node: Node) {
  return Object.entries(node).flatMap(([key, value]: [string, unknown]) =>
    label(node, key) ? [] : (Array.isArray(value) ? value : [value]).filter(isNode),
  );
}

const HOLDERS = new Set(["TSTypeLiteral", "TSFunctionType", "TSConstructorType"]);
const WRAPPERS = new Set([
  ...["TSUnionType", "TSIntersectionType", "TSTupleType", "TSArrayType", "TSNamedTupleMember"],
  ...["TSOptionalType", "TSRestType", "TSTypeOperator"],
]);

function holds(node: Node, holder: (node: Node) => boolean): boolean {
  if (HOLDERS.has(node.type) || (node.type === "TSTypeOperator" && node.operator === "keyof"))
    return false;
  if (node.type === "TSIndexedAccessType" && node.objectType.type === "TSTypeReference")
    return holder(holder(node.objectType.typeName) ? node.indexType : node);
  if (WRAPPERS.has(node.type)) return children(node).some((child) => holds(child, holder));
  return holder(node);
}

const isJson = (node: Node | undefined): boolean =>
  (node?.type === "Literal" && node.value === "json") ||
  (node?.type === "ObjectExpression" &&
    node.properties.some(
      (p) => p.type === "Property" && nameOf(p.key) === "type" && isJson(p.value),
    ));

const CARRIERS = new Set([
  ...["ArrayExpression", "ObjectExpression", "Property", "SpreadElement", "AwaitExpression"],
  ...["ConditionalExpression", "LogicalExpression", "TSNonNullExpression"],
]);

function untyped(node: Node | null | undefined): boolean {
  if (node?.type !== "CallExpression" || node.callee.type !== "MemberExpression")
    return !!node && CARRIERS.has(node.type) && children(node).some(untyped);
  const method = nameOf(node.callee.property);
  return (
    (nameOf(node.callee.object) === "JSON" && method === "parse") ||
    method === "json" ||
    (/^get(WithMetadata)?$/.test(method) && isJson(node.arguments[1]))
  );
}

const FUNCTIONS = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"]);

function enclosing(node: Node) {
  let parent = node.parent;
  while (parent && !FUNCTIONS.has(parent.type)) parent = parent.parent;
  return parent && "returnType" in parent ? parent.returnType : undefined;
}

type Messages = "assertion" | "typeArgument" | "parsed" | "relay";

const ownedTypes = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      assertion:
        "Build src/events values with the functions in src/events, never with a type assertion.",
      typeArgument:
        "Let TypeScript infer src/events types instead of passing one as a type argument, which can skip their checks.",
      parsed:
        "Parse untyped data with the functions in src/events instead of typing it as a src/events type.",
      relay:
        "Import src/events types from src/events itself so the type assertion ban can see them.",
    },
  } satisfies TSESLint.RuleMetaData<Messages>,
  create(context: Context<Messages>) {
    const importer = fromRoot(context.filename);
    if ([MODULE, TESTS].some((owner) => importer.startsWith(`${owner}/`))) return {};
    const owned = (specifier: unknown) =>
      typeof specifier === "string" && `${resolved(specifier, importer)}/`.startsWith(`${MODULE}/`);
    const imported = new Set<string>();
    const guarded = new Set<string>();
    const aliases = new Map<string, () => boolean>();
    const exposes = (name: string) => imported.has(name) || !!aliases.get(name)?.();
    const relays = (node: Node): boolean =>
      node.type === "Identifier"
        ? exposes(node.name)
        : node.type === "MemberExpression" && imported.has(nameOf(node.object));
    const declarations: [string[], Node][] = [];
    const checks: [Node, Messages, () => boolean][] = [];
    const mentions = (node: Node | null | undefined): boolean =>
      !!node &&
      ((node.type === "Identifier" && guarded.has(node.name)) ||
        (node.type === "TSImportType" && owned(node.source.value)) ||
        children(node).some(mentions));
    const bound = (node: Node): string[] =>
      node.type === "Identifier" ? [node.name] : children(node).flatMap(bound);
    const check = (node: Node, messageId: Messages, bad: () => boolean) =>
      checks.push([node, messageId, bad]);
    const declare = (node: Node & { id?: Node | null }) =>
      node.id && declarations.push([bound(node.id), node]);
    const exported = (node: Node) => !!node.parent?.type.startsWith("Export");
    const sink = (node: Node, type: Node | null | undefined, value: Node | null | undefined) =>
      check(node, "parsed", () => mentions(type) && untyped(value));
    return {
      ImportDeclaration(node) {
        if (owned(node.source.value))
          for (const { local } of node.specifiers) imported.add(local.name);
      },
      TSImportEqualsDeclaration(node) {
        declare(node);
        if (
          node.moduleReference.type === "TSExternalModuleReference" &&
          owned(node.moduleReference.expression.value)
        )
          imported.add(node.id.name);
      },
      "ClassDeclaration, FunctionDeclaration, TSDeclareFunction, TSEnumDeclaration, TSModuleDeclaration":
        declare,
      TSTypeAliasDeclaration(node) {
        declare(node);
        aliases.set(
          node.id.name,
          () => holds(node.typeAnnotation, mentions) || mentions(node.typeParameters),
        );
        check(node, "relay", () => exported(node) && exposes(node.id.name));
      },
      TSInterfaceDeclaration(node) {
        declare(node);
        aliases.set(node.id.name, () => node.extends.some(mentions));
        check(node, "relay", () => exported(node) && exposes(node.id.name));
      },
      VariableDeclarator(node) {
        declare(node);
        const { id, init } = node;
        sink(node, id.typeAnnotation, init);
        if (id.type !== "Identifier" || !init) return;
        aliases.set(id.name, () => relays(init));
        check(node, "relay", () => exported(node.parent) && exposes(id.name));
      },
      ExportDefaultDeclaration: (node) => check(node, "relay", () => relays(node.declaration)),
      Identifier(node) {
        if (node.typeAnnotation) declarations.push([[node.name], node.typeAnnotation]);
      },
      ReturnStatement: (node) => sink(node, enclosing(node), node.argument),
      "ArrowFunctionExpression[expression=true]": (node: TSESTree.ArrowFunctionExpression) =>
        sink(node.body, node.returnType, node.body),
      AssignmentExpression: (node) => sink(node, node.left, node.right),
      "CallExpression, NewExpression"(node: TSESTree.CallExpression | TSESTree.NewExpression) {
        check(node, "parsed", () => mentions(node.callee) && node.arguments.some(untyped));
      },
      "CallExpression, NewExpression, TaggedTemplateExpression, TSInstantiationExpression, JSXOpeningElement"(
        node: Node & { typeArguments?: TSESTree.TSTypeParameterInstantiation | undefined },
      ) {
        if (node.typeArguments)
          check(node.typeArguments, "typeArgument", () => mentions(node.typeArguments));
      },
      "TSAsExpression, TSTypeAssertion, TSTypePredicate"(
        node: TSESTree.TSAsExpression | TSESTree.TSTypeAssertion | TSESTree.TSTypePredicate,
      ) {
        check(node, "assertion", () => mentions(node.typeAnnotation));
      },
      TSSatisfiesExpression: (node) => sink(node, node.typeAnnotation, node.expression),
      PropertyDefinition: (node) => sink(node, node.typeAnnotation, node.value),
      ExportNamedDeclaration(node) {
        check(node, "relay", () => owned(node.source?.value));
      },
      ExportAllDeclaration(node) {
        check(node, "relay", () => owned(node.source.value));
      },
      ExportSpecifier(node) {
        check(
          node,
          "relay",
          () =>
            node.parent.type === "ExportNamedDeclaration" &&
            !node.parent.source &&
            exposes(nameOf(node.local)),
        );
      },
      "Program:exit"() {
        for (const name of imported) guarded.add(name);
        for (let grew = true; grew; ) {
          grew = false;
          for (const [names, node] of declarations)
            if (names.some((name) => !guarded.has(name)) && mentions(node)) {
              for (const name of names) guarded.add(name);
              grew = true;
            }
        }
        for (const [node, messageId, bad] of checks) if (bad()) context.report({ node, messageId });
      },
    } satisfies TSESLint.RuleListener;
  },
};

const isString = (node: Node | null | undefined): node is TSESTree.StringLiteral =>
  node?.type === "Literal" && typeof node.value === "string";

const plainOptions = (node: Node | undefined) =>
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
  } satisfies TSESLint.RuleMetaData<"internal" | "computed">,
  create(context: Context<"internal" | "computed">) {
    const importer = fromRoot(context.filename);
    const fence = (node: Node, specifier: string) =>
      outsideOwner(specifier, importer) && context.report({ node, messageId: "internal" });
    const computed = (node: Node) => context.report({ node, messageId: "computed" });
    const load = (node: Node | undefined, at: Node) =>
      isString(node) ? fence(node, node.value) : computed(node ?? at);
    const glob = (node: TSESTree.CallExpression) => {
      const [patterns, options] = node.arguments;
      const list = patterns?.type === "ArrayExpression" ? patterns.elements : [patterns];
      if (!plainOptions(options)) return computed(node);
      const strings = list.filter(isString);
      if (strings.length !== list.length) return computed(node);
      for (const pattern of strings) {
        const path = pattern.value.replace(/^!/, "");
        const directory = path.slice(path.startsWith("@/") ? 2 : 0, path.lastIndexOf("/") + 1);
        if (GLOB_DIRECTORY.test(directory) || path.includes("**")) computed(pattern);
        else fence(pattern, path);
      }
    };
    const literal = (node: { source: TSESTree.StringLiteral | null }) =>
      node.source && fence(node.source, node.source.value);
    return {
      ImportDeclaration: literal,
      ExportNamedDeclaration: literal,
      ExportAllDeclaration: literal,
      TSImportType: literal,
      TSExternalModuleReference: (node) => load(node.expression, node),
      ImportExpression: (node) => load(node.source, node),
      CallExpression(node) {
        const { callee } = node;
        const member = callee.type === "MemberExpression" && !callee.computed ? callee : undefined;
        const object = member?.object;
        if (
          object?.type === "MetaProperty" &&
          object.meta.name === "import" &&
          nameOf(member?.property) === "glob"
        )
          glob(node);
        else if (
          nameOf(callee) === "require" ||
          (nameOf(object) === "module" && nameOf(member?.property) === "require") ||
          (nameOf(object) === "vi" &&
            /^(importActual|importMock|mock|doMock|unmock|doUnmock)$/.test(
              nameOf(member?.property),
            ) &&
            node.arguments[0]?.type !== "ImportExpression")
        )
          load(node.arguments[0], node);
      },
    } satisfies TSESLint.RuleListener;
  },
};

export default {
  rules: { "owned-types": ownedTypes, "internal-imports": internalImports },
};
