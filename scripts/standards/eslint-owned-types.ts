import { relative, resolve, sep } from "node:path";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import ts from "typescript";

type Node = TSESTree.Node;
type Messages = "assertion" | "unsafe" | "forged" | "declared" | "merged";
type Context = TSESLint.RuleContext<Messages, [{ modules?: string[] }?]>;

const ROOT = resolve(import.meta.dirname, "../..");
export const fromRoot = (file: string) => relative(ROOT, file).split(sep).join("/");
const { Any, Never, TypeParameter, Object: Structure, Null, Undefined, Void } = ts.TypeFlags;
const Declare = ts.SyntaxKind.DeclareKeyword;

function memo<T>(fallback: T, compute: (type: ts.Type, self: (type: ts.Type) => T) => T) {
  const cache = new Map<ts.Type, T>();
  return function run(type: ts.Type): T {
    if (cache.has(type)) return cache.get(type) ?? fallback;
    cache.set(type, fallback);
    cache.set(type, compute(type, run));
    return cache.get(type) ?? fallback;
  };
}

const build = (what: string) => `${what}. Build it with the functions in {{module}}.`;

export const ownedTypes = {
  meta: {
    type: "problem",
    schema: [
      { type: "object", properties: { modules: { type: "array", items: { type: "string" } } } },
    ],
    messages: {
      assertion: build("A type assertion or predicate cannot create a {{module}} value"),
      unsafe: build("An any- or never-typed value would reach a {{module}} type unchecked"),
      forged: build("This call returns a {{module}} type that its inputs and body do not carry"),
      declared: build("A declaration without a body cannot create a {{module}} value"),
      merged: build("Merging into a {{module}} value skips its checks"),
    },
  } satisfies TSESLint.RuleMetaData<Messages>,
  create(context: Context) {
    const modules = context.options[0]?.modules ?? ["src/events"];
    const moduleOf = (file: string) => modules.find((m) => fromRoot(file).startsWith(`${m}/`));
    const importer = fromRoot(context.filename);
    const owners = modules.flatMap((m) => [m, m.replace(/^src\//, "test/")]);
    if (owners.some((owner) => importer.startsWith(`${owner}/`))) return {};
    const { program, esTreeNodeToTSNodeMap: nodes } = context.sourceCode.parserServices ?? {};
    if (!program || !nodes)
      throw new Error(`isolated/owned-types needs type information: ${importer}`);
    const checker = program.getTypeChecker();
    const external = (file: ts.SourceFile) =>
      program.isSourceFileDefaultLibrary(file) || program.isSourceFileFromExternalLibrary(file);
    const typeOf = (node: Node) => checker.getTypeAtLocation(nodes.get(node));
    const local = (type: ts.Type) =>
      !!type.getSymbol()?.declarations?.some((d) => !external(d.getSourceFile()));
    const report = (node: Node, messageId: Messages, [module]: readonly string[]) =>
      module && context.report({ node, messageId, data: { module } });

    function parts(type: ts.Type): readonly ts.Type[] {
      if (type.isUnionOrIntersection()) return type.types;
      if (!(type.flags & Structure)) return [];
      const object = type as ts.TypeReference;
      const mapped = object.objectFlags & ts.ObjectFlags.Mapped;
      const args =
        object.objectFlags & ts.ObjectFlags.Reference ? checker.getTypeArguments(object) : [];
      const found = [...args, ...(mapped ? [] : (type.aliasTypeArguments ?? []))];
      if (!mapped && !local(type)) return found;
      return [
        ...found,
        ...checker.getPropertiesOfType(type).map((p) => checker.getTypeOfSymbol(p)),
        ...[...type.getCallSignatures(), ...type.getConstructSignatures()].map((signature) =>
          signature.getReturnType(),
        ),
        ...checker.getIndexInfosOfType(type).map((info) => info.type),
      ];
    }

    const hidden = ts.ModifierFlags.Private | ts.ModifierFlags.Protected;
    const seals = (type: ts.Type) =>
      (type.flags & Structure ? checker.getPropertiesOfType(type) : []).flatMap((property) => {
        const [declaration] = property.declarations ?? [];
        const sealed =
          /^__[@#]/.test(String(property.escapedName)) ||
          (!!declaration && ts.getCombinedModifierFlags(declaration) & hidden);
        const module = sealed && declaration && moduleOf(declaration.getSourceFile().fileName);
        return module ? [module] : [];
      });
    const brands = memo([], (t): string[] => [...seals(t), ...parts(t).flatMap(brands)]);
    const holds = (flags: ts.TypeFlags) =>
      memo(false, (t, self): boolean => !!(t.flags & flags) || parts(t).some(self));
    const hollow = holds(Any | Never);
    const generic = holds(TypeParameter);

    const signatureOf = (node: ts.CallLikeExpression) => {
      const declaration = checker.getResolvedSignature(node)?.declaration;
      return declaration && !ts.isJSDocSignature(declaration) ? declaration : undefined;
    };
    const declares = (node: ts.Node) =>
      ts.canHaveModifiers(node) && !!ts.getModifiers(node)?.some((m) => m.kind === Declare);
    const ambient = (node: ts.Node) =>
      !!ts.findAncestor(node, (n) =>
        ts.isSourceFile(n) ? n.isDeclarationFile || "quit" : declares(n),
      );
    const declaredReturn = (owner: ts.SignatureDeclaration | ts.ClassLikeDeclaration) => {
      const signature = !ts.isClassLike(owner) && checker.getSignatureFromDeclaration(owner);
      return signature ? signature.getReturnType() : checker.getTypeAtLocation(owner);
    };

    const forged = (
      node: TSESTree.CallExpression | TSESTree.NewExpression | TSESTree.TaggedTemplateExpression,
    ) => {
      const tagged = node.type === "TaggedTemplateExpression";
      const [args, callee] = tagged ? [[], node.tag] : [node.arguments, node.callee];
      const receiver = callee.type === "MemberExpression" ? [callee.object] : [];
      const inputs = [...args, ...receiver].flatMap((input) => brands(typeOf(input)));
      const tsNode = nodes.get(node);
      const created = ts.isNewExpression(tsNode) && checker.getTypeAtLocation(tsNode).getSymbol();
      const owner =
        signatureOf(tsNode) ?? (created || undefined)?.declarations?.find(ts.isClassLike);
      if (owner && moduleOf(owner.getSourceFile().fileName)) return;
      const resolved = checker.getResolvedSignature(tsNode);
      const predicate = resolved && checker.getTypePredicateOfSignature(resolved)?.type;
      const narrowed = predicate ? brands(predicate) : [];
      report(
        node,
        "assertion",
        narrowed.filter((m) => !inputs.includes(m)),
      );
      const library = !!owner && external(owner.getSourceFile());
      const declared = owner && declaredReturn(owner);
      if (library && declared?.isIntersection() && args.some((a) => hollow(typeOf(a))))
        return report(node, "merged", inputs);
      const type = typeOf(node);
      const result = brands(type);
      if (!result.length) return;
      if (!library && declared && generic(declared)) return report(node, "forged", result);
      const objects = type.isIntersection() ? type.types.filter((t) => t.flags & Structure) : [];
      const owned = objects.filter((part) => brands(part).length);
      const names = new Set(owned.flatMap((part) => part.getProperties().map((p) => p.name)));
      const overwrites = objects.some(
        (part) => !owned.includes(part) && part.getProperties().some((p) => names.has(p.name)),
      );
      const sealed = objects.filter((part) => seals(part).length).length;
      if (library && (overwrites || (sealed && objects.length > sealed)))
        return report(node, "merged", result);
      const empty = args.every((input) =>
        input.type === "ArrayExpression"
          ? !input.elements.length
          : typeOf(input).flags & (Null | Undefined | Void),
      );
      const container = checker.isArrayType(type) || checker.isTupleType(type) || !local(type);
      if (library && empty && container && type.getSymbol()) return;
      const trusted = owner && !(ts.isClassLike(owner) && ambient(owner)) && declared;
      const carried = new Set([...(trusted ? brands(trusted) : []), ...inputs]);
      const missing = result.filter((m) => !carried.has(m));
      report(node, "forged", missing);
    };

    function sink(node: TSESTree.Expression, tsNode: ts.Expression) {
      const { parent } = node;
      if (parent.type === "ForOfStatement" && parent.right === node)
        return parent.left.type === "VariableDeclaration" ? undefined : typeOf(parent.left);
      const named = "name" in tsNode.parent && tsNode.parent.name === tsNode;
      return named ? undefined : checker.getContextualType(tsNode);
    }

    return {
      "TSAsExpression, TSTypeAssertion"(node: TSESTree.TSAsExpression | TSESTree.TSTypeAssertion) {
        report(node, "assertion", brands(typeOf(node.typeAnnotation)));
      },
      TSTypePredicate(node) {
        if (node.typeAnnotation)
          report(node, "assertion", brands(typeOf(node.typeAnnotation.typeAnnotation)));
      },
      "CallExpression, NewExpression, TaggedTemplateExpression": forged,
      VariableDeclarator(node) {
        if (!node.init && (node.definite || ambient(nodes.get(node))))
          report(node, "declared", brands(typeOf(node.id)));
      },
      PropertyDefinition(node) {
        if (!node.value && (node.definite || node.declare))
          report(node, "declared", brands(typeOf(node)));
      },
      "TSDeclareFunction, TSEmptyBodyFunctionExpression"(
        node: TSESTree.TSDeclareFunction | TSESTree.TSEmptyBodyFunctionExpression,
      ) {
        const signature = nodes.get(node.type === "TSDeclareFunction" ? node : node.parent);
        report(node, "declared", brands(declaredReturn(signature as ts.SignatureDeclaration)));
      },
      ":expression"(node: TSESTree.Expression) {
        const type = typeOf(node);
        const wrapper = node.type === "ArrayExpression" || node.type.endsWith("FunctionExpression");
        if (wrapper || !hollow(type)) return;
        const tsNode = nodes.get(node);
        const target = ts.isExpression(tsNode) && sink(node, tsNode);
        const call = ts.isCallExpression(tsNode) ? signatureOf(tsNode) : undefined;
        const throws = type.flags & Never && call && "body" in call && call.body;
        if (target && !throws) report(node, "unsafe", brands(target));
      },
    } satisfies TSESLint.RuleListener;
  },
};
