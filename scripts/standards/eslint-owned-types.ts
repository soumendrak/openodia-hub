import { relative, resolve, sep } from "node:path";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import ts from "typescript";

type Node = TSESTree.Node;
type Messages = "assertion" | "unsafe" | "forged" | "declared" | "merged";
type Context = TSESLint.RuleContext<Messages, [{ modules?: string[] }?]>;

const ROOT = resolve(import.meta.dirname, "../..");
const fromRoot = (file: string) => relative(ROOT, file).split(sep).join("/");
const { Any, Never, TypeParameter, Object: Structure, Null, Undefined, Void } = ts.TypeFlags;

function memo<T>(fallback: T, compute: (type: ts.Type) => T) {
  const cache = new Map<ts.Type, T>();
  return function run(type: ts.Type): T {
    if (cache.has(type) || cache.size > 5000) return cache.get(type) ?? fallback;
    cache.set(type, fallback);
    cache.set(type, compute(type));
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
    const report = (node: Node, messageId: Messages, [module]: readonly string[]) =>
      module && context.report({ node, messageId, data: { module } });

    function parts(type: ts.Type): readonly ts.Type[] {
      if (type.isUnionOrIntersection()) return type.types;
      if (!(type.flags & Structure)) return [];
      const object = type as ts.TypeReference;
      const found = [
        ...(object.objectFlags & ts.ObjectFlags.Reference ? checker.getTypeArguments(object) : []),
        ...(type.aliasTypeArguments ?? []),
      ];
      const files = type.getSymbol()?.declarations?.map((d) => d.getSourceFile());
      if (!files || files.every(external)) return found;
      return [
        ...found,
        ...checker.getPropertiesOfType(type).map((p) => checker.getTypeOfSymbol(p)),
        ...type.getCallSignatures().map((signature) => signature.getReturnType()),
        ...checker.getIndexInfosOfType(type).map((info) => info.type),
      ];
    }

    const seals = (type: ts.Type) =>
      (type.flags & Structure ? checker.getPropertiesOfType(type) : []).flatMap((property) => {
        const file = property.declarations?.[0]?.getSourceFile().fileName ?? "";
        const module = /^__[@#]/.test(String(property.escapedName)) && moduleOf(file);
        return module ? [module] : [];
      });
    const brands: (type: ts.Type) => string[] = memo([], (t) => [
      ...seals(t),
      ...parts(t).flatMap(brands),
    ]);
    const holds = (flags: ts.TypeFlags) => {
      const run: (type: ts.Type) => boolean = memo(
        false,
        (t) => !!(t.flags & flags) || parts(t).some(run),
      );
      return run;
    };
    const hollow = holds(Any | Never);
    const generic = holds(TypeParameter);

    const signatureOf = (node: ts.CallLikeExpression) => {
      const declaration = checker.getResolvedSignature(node)?.declaration;
      return declaration && !ts.isJSDocSignature(declaration) ? declaration : undefined;
    };
    const body = (node: ts.Node) =>
      "body" in node ? (node.body as ts.Node | undefined) : undefined;
    const returned = (declaration: ts.SignatureDeclaration) => {
      const signature = checker.getSignatureFromDeclaration(declaration);
      return signature ? brands(checker.getReturnTypeOfSignature(signature)) : [];
    };

    function trusted(owner: ts.SignatureDeclaration | ts.ClassLikeDeclaration) {
      if (ts.isClassLike(owner))
        return declared(owner) ? [] : brands(checker.getTypeAtLocation(owner));
      const overload =
        (ts.isFunctionDeclaration(owner) || ts.isMethodDeclaration(owner)) && !body(owner);
      return overload ? [] : returned(owner);
    }

    const laundering = new Map<ts.Node, boolean>();
    function launders(declaration: ts.Node): boolean {
      const block = body(declaration);
      if (!block || laundering.has(declaration)) return laundering.get(declaration) ?? false;
      laundering.set(declaration, false);
      const visit = (node: ts.Node): boolean => {
        const cast = ts.isAsExpression(node) || ts.isTypeAssertionExpression(node);
        if (cast && generic(checker.getTypeFromTypeNode(node.type))) return true;
        const callee = ts.isCallExpression(node) ? signatureOf(node) : undefined;
        if (callee && !external(callee.getSourceFile()) && generic(checker.getTypeAtLocation(node)))
          if (!body(callee) || launders(callee)) return true;
        const any = ts.isExpression(node) && checker.getTypeAtLocation(node).flags & Any;
        const target = any ? checker.getContextualType(node as ts.Expression) : undefined;
        return (!!target && generic(target)) || !!ts.forEachChild(node, visit);
      };
      laundering.set(declaration, visit(block));
      return laundering.get(declaration) ?? false;
    }

    const forged = (node: TSESTree.CallExpression | TSESTree.NewExpression) => {
      const type = typeOf(node);
      const result = brands(type);
      if (!result.length) return;
      const tsNode = nodes.get(node);
      const created = ts.isNewExpression(tsNode) && checker.getTypeAtLocation(tsNode).getSymbol();
      const owner =
        signatureOf(tsNode) ?? (created || undefined)?.declarations?.find(ts.isClassLike);
      if (owner && moduleOf(owner.getSourceFile().fileName)) return;
      if (owner && launders(owner)) return report(node, "forged", result);
      const library = !!owner && external(owner.getSourceFile());
      const objects = type.isIntersection() ? type.types.filter((t) => t.flags & Structure) : [];
      const sealed = objects.map((part) => !!seals(part).length);
      if (library && sealed.includes(true) && sealed.includes(false))
        return report(node, "merged", result);
      const empty = node.arguments.every((input) =>
        input.type === "ArrayExpression"
          ? !input.elements.length
          : typeOf(input).flags & (Null | Undefined | Void),
      );
      if (library && empty) return;
      const receiver = node.callee.type === "MemberExpression" ? [node.callee.object] : [];
      const inputs = [...node.arguments, ...receiver].flatMap((input) => brands(typeOf(input)));
      const carried = new Set([...(owner ? trusted(owner) : []), ...inputs]);
      report(
        node,
        "forged",
        result.filter((m) => !carried.has(m)),
      );
    };

    function declared(node: ts.Node | undefined): boolean {
      if (!node || ts.isSourceFile(node)) return !!node?.isDeclarationFile;
      const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
      return (
        !!modifiers?.some((m) => m.kind === ts.SyntaxKind.DeclareKeyword) || declared(node.parent)
      );
    }

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
      "CallExpression, NewExpression": forged,
      VariableDeclarator(node) {
        if (!node.init && (node.definite || declared(nodes.get(node))))
          report(node, "declared", brands(typeOf(node.id)));
      },
      PropertyDefinition(node) {
        if (!node.value && (node.definite || node.declare))
          report(node, "declared", brands(typeOf(node.key)));
      },
      "TSDeclareFunction, TSEmptyBodyFunctionExpression"(
        node: TSESTree.TSDeclareFunction | TSESTree.TSEmptyBodyFunctionExpression,
      ) {
        const signature = nodes.get(node.type === "TSDeclareFunction" ? node : node.parent);
        report(node, "declared", returned(signature as ts.SignatureDeclaration));
      },
      ":expression"(node: TSESTree.Expression) {
        const type = typeOf(node);
        const wrapper = node.type === "ArrayExpression" || node.type.endsWith("FunctionExpression");
        if (wrapper || !hollow(type)) return;
        const tsNode = nodes.get(node);
        const target = ts.isExpression(tsNode) && sink(node, tsNode);
        const call = ts.isCallExpression(tsNode) ? signatureOf(tsNode) : undefined;
        const throws = type.flags & Never && call && body(call);
        if (target && !throws) report(node, "unsafe", brands(target));
      },
    } satisfies TSESLint.RuleListener;
  },
};
