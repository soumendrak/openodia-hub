import { relative, resolve, sep } from "node:path";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import ts from "typescript";

type Node = TSESTree.Node;
type Messages = "assertion" | "unsafe" | "forged" | "laundered" | "declared" | "merged";

const ROOT = resolve(import.meta.dirname, "../..");
export const fromRoot = (file: string) => relative(ROOT, file).split(sep).join("/");
const { Any, Never, TypeParameter: Param, Object: Shape, Null, Undefined, Void } = ts.TypeFlags;
const { Private, Protected } = ts.ModifierFlags;
const Declare = ts.SyntaxKind.DeclareKeyword;

const shared = new Map<string, WeakMap<ts.Type, readonly string[]>>();
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
      laundered: build("This lets a generic helper return a {{module}} type unchecked"),
      declared: build("A declaration without a body cannot create a {{module}} value"),
      merged: build("Merging into a {{module}} value skips its checks"),
    },
  } satisfies TSESLint.RuleMetaData<Messages>,
  create(context: TSESLint.RuleContext<Messages, [{ modules?: string[] }?]>) {
    const modules = context.options[0]?.modules ?? ["src/events"];
    const moduleOf = (file: string) => modules.find((m) => fromRoot(file).startsWith(`${m}/`));
    const guarded = (node: ts.Node) => !!moduleOf(node.getSourceFile().fileName);
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

    function parts(type: ts.Type, deep: boolean): readonly ts.Type[] {
      if (type.isUnionOrIntersection()) return type.types;
      const base = type.flags & ts.TypeFlags.Instantiable && checker.getBaseConstraintOfType(type);
      if (base) return [base];
      if (!(type.flags & Shape)) return [];
      const object = type as ts.TypeReference;
      const mapped = object.objectFlags & ts.ObjectFlags.Mapped;
      const args =
        object.objectFlags & ts.ObjectFlags.Reference ? checker.getTypeArguments(object) : [];
      const found = [...args, ...(mapped ? [] : (type.aliasTypeArguments ?? []))];
      const fields = checker.getPropertiesOfType(type).map((p) => checker.getTypeOfSymbol(p));
      if (!mapped && !local(type)) return deep ? [...found, ...fields] : found;
      const signatures = [...type.getCallSignatures(), ...type.getConstructSignatures()];
      const returns = signatures.map((signature) => signature.getReturnType());
      const indexes = checker.getIndexInfosOfType(type).map((info) => info.type);
      return [...found, ...fields, ...returns, ...indexes];
    }

    function closure(name: string, own: (type: ts.Type) => readonly string[], deep = false) {
      const key = `${name} ${modules.join()}`;
      const done = shared.get(key) ?? new WeakMap<ts.Type, readonly string[]>();
      shared.set(key, done);
      const stack: ts.Type[] = [];
      function visit(type: ts.Type): readonly [readonly string[], number] {
        const finished = done.get(type);
        if (finished) return [finished, Infinity];
        if (stack.includes(type)) return [[], stack.indexOf(type)];
        const at = stack.push(type) - 1;
        const reached = parts(type, deep).map(visit);
        const result = [...new Set([...own(type), ...reached.flatMap(([values]) => values)])];
        const low = Math.min(at, ...reached.map(([, reach]) => reach));
        if (low === at) for (const member of stack.splice(at)) done.set(member, result);
        return [result, low];
      }
      return (type: ts.Type) => visit(type)[0];
    }

    const seals = (type: ts.Type) =>
      (type.flags & Shape ? checker.getPropertiesOfType(type) : []).flatMap((property) => {
        const [declaration] = property.declarations ?? [];
        const key = declaration && ts.getNameOfDeclaration(declaration);
        const slot = key && ts.isComputedPropertyName(key) ? key.expression : undefined;
        const sealed =
          String(property.escapedName).startsWith("__#") ||
          (!!declaration && ts.getCombinedModifierFlags(declaration) & (Private | Protected)) ||
          (slot && checker.getTypeAtLocation(slot).getSymbol()?.declarations?.some(guarded));
        const module = sealed && declaration && moduleOf(declaration.getSourceFile().fileName);
        return module ? [module] : [];
      });
    const brands = closure("brands", seals);
    const holds = (flags: ts.TypeFlags, deep?: boolean) => (type: ts.Type) =>
      closure(String(flags), (t) => (t.flags & flags ? ["held"] : []), deep)(type).length > 0;
    const [hollow, generic] = [holds(Any | Never, true), holds(Param)];

    const signatureOf = (node: ts.CallLikeExpression) => {
      const declaration = checker.getResolvedSignature(node)?.declaration;
      return declaration && !ts.isJSDocSignature(declaration) ? declaration : undefined;
    };
    const ambient = (node: ts.Node) =>
      !!ts.findAncestor(node, (n) =>
        ts.isSourceFile(n)
          ? n.isDeclarationFile || "quit"
          : ts.canHaveModifiers(n) && !!ts.getModifiers(n)?.some((m) => m.kind === Declare),
      );
    const declaredReturn = (owner: ts.SignatureDeclaration | ts.ClassLikeDeclaration) => {
      const signature = !ts.isClassLike(owner) && checker.getSignatureFromDeclaration(owner);
      return signature ? signature.getReturnType() : checker.getTypeAtLocation(owner);
    };

    const laundered = (fn: ts.Node, seen = new Set([fn])): ts.Node | undefined => {
      const find = (n: ts.Node): ts.Node | undefined => {
        const cast = ts.isAsExpression(n) || ts.isTypeAssertionExpression(n);
        const definite = "exclamationToken" in n && !!n.exclamationToken;
        if ((cast || definite) && generic(checker.getTypeAtLocation(cast ? n.type : n))) return n;
        const sunk = ts.isExpression(n) && checker.getTypeAtLocation(n).flags & (Any | Never);
        const contextual = sunk && checker.getContextualType(n);
        if (contextual && generic(contextual)) return n;
        const callee = ts.isCallLikeExpression(n) && signatureOf(n);
        const made = callee && ambient(callee) && checker.getTypeAtLocation(n).flags & Param;
        const inner = callee && !seen.has(callee) && laundered(callee, seen.add(callee));
        return made ? n : inner || ts.forEachChild(n, find);
      };
      return ts.forEachChild(fn, find);
    };

    const forged = (
      node: TSESTree.CallExpression | TSESTree.NewExpression | TSESTree.TaggedTemplateExpression,
    ) => {
      const [args, callee] =
        node.type === "TaggedTemplateExpression"
          ? [node.quasi.expressions, node.tag]
          : [node.arguments, node.callee];
      const receiver = callee.type === "MemberExpression" ? [callee.object] : [];
      const inputs = [...args, ...receiver].flatMap((input) => brands(typeOf(input)));
      const tsNode = nodes.get(node);
      const created = ts.isNewExpression(tsNode) && checker.getTypeAtLocation(tsNode).getSymbol();
      const owner =
        signatureOf(tsNode) ?? (created || undefined)?.declarations?.find(ts.isClassLike);
      if (owner && guarded(owner)) return;
      const resolved = checker.getResolvedSignature(tsNode);
      const predicate = resolved && checker.getTypePredicateOfSignature(resolved)?.type;
      const narrowed = predicate ? brands(predicate).filter((m) => !inputs.includes(m)) : [];
      report(node, "assertion", narrowed);
      const library = !!owner && external(owner.getSourceFile());
      const declared = owner && declaredReturn(owner);
      if (library && declared?.isIntersection() && args.some((a) => hollow(typeOf(a))))
        return report(node, "merged", inputs);
      const type = typeOf(node);
      const result = brands(type);
      const objects = type.isIntersection() ? type.types.filter((t) => t.flags & Shape) : [];
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
      const to = args.map((a) => checker.getContextualType(nodes.get(a) as ts.Expression));
      const via = [...receiver.map(typeOf), ...to.filter((_, i) => brands(typeOf(args[i]!))[0])];
      const carried = new Set([declared, ...via].flatMap((t) => (t ? brands(t) : [])));
      const missing = result.filter((m) => !carried.has(m));
      const cast = declared && generic(declared) && owner && laundered(owner);
      const here = cast && context.sourceCode.parserServices?.tsNodeToESTreeNodeMap?.get(cast);
      report(here || node, here ? "laundered" : "forged", cast ? result : missing);
    };

    function sink(node: TSESTree.Expression, tsNode: ts.Expression) {
      const { parent } = node;
      if (parent.type === "ForOfStatement" && parent.right === node) return typeOf(parent.left);
      const named = "name" in tsNode.parent && tsNode.parent.name === tsNode;
      const element = ts.isSpreadElement(tsNode.parent) ? tsNode.parent : tsNode;
      return named ? undefined : checker.getContextualType(element);
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
        if (!node.value && (node.definite || node.static || ambient(nodes.get(node))))
          report(node, "declared", brands(typeOf(node)));
      },
      "TSDeclareFunction, TSEmptyBodyFunctionExpression"(
        node: TSESTree.TSDeclareFunction | TSESTree.TSEmptyBodyFunctionExpression,
      ) {
        const signature = nodes.get(node.type === "TSDeclareFunction" ? node : node.parent);
        report(node, "declared", brands(declaredReturn(signature as ts.SignatureDeclaration)));
      },
      ":expression"(node: TSESTree.Expression) {
        const tsNode = nodes.get(node);
        const target = ts.isExpression(tsNode) && sink(node, tsNode);
        const wrapper = node.type === "ArrayExpression" || node.type.endsWith("FunctionExpression");
        const type = !wrapper && target && brands(target).length && typeOf(node);
        if (!target || !type || !hollow(type)) return;
        const call = ts.isCallExpression(tsNode) ? signatureOf(tsNode) : undefined;
        const body = type.flags & Never && call && "body" in call && call.body;
        const throws = body && ts.isBlock(body) && body.statements.every(ts.isThrowStatement);
        if (!throws) report(node, "unsafe", brands(target));
      },
    } satisfies TSESLint.RuleListener;
  },
};
