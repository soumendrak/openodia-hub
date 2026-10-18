import { posix } from "node:path";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { fromRoot, ownedTypes } from "./eslint-owned-types.ts";

type Node = TSESTree.Node;

type Context<Message> = {
  readonly filename: string;
  report(descriptor: { node: Node; messageId: Message }): void;
};

const GLOB_DIRECTORY = /[*?[\]{}()!+@]/;

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
        else if (path === pattern.value) fence(pattern, path);
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
        const member = callee.type === "MemberExpression" ? callee : undefined;
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
