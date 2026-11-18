import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import ts from "typescript";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import config from "../eslint.config.js";
import { keysOverlap } from "../scripts/standards/eslint-owned-types";
import mainConfig from "./standards/owned-types-main-config.js";

const MODEL = `
declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };
export type IsoDay = Brand<string, "IsoDay">;
export type Text = Brand<string, "Text">;
export const isoDay = (s: string) => (/^\\d{4}-\\d{2}-\\d{2}$/.test(s) ? (s as IsoDay) : undefined);
export const text = (s: string) => (s ? (s as Text) : undefined);
export class ExactDates {
  readonly #sealed = true;
  private constructor(readonly start: IsoDay, readonly end: IsoDay) {}
  static of(start: IsoDay, end: IsoDay) {
    return start <= end ? new ExactDates(start, end) : undefined;
  }
  get sealed() {
    return this.#sealed;
  }
}
export class Sealed {
  private sealed = true;
  get open() {
    return !this.sealed;
  }
}
export type Tagged = { readonly [Symbol.toStringTag]: string; readonly name: string };
export type Dates = ExactDates | { readonly kind: "approximate"; readonly month: number };
export type CanonicalEvent = { readonly title: Text; readonly dates: Dates; readonly id: string };
export const join = (title: Text, dates: Dates): CanonicalEvent => ({ title, dates, id: "x" });
export const save = (event: CanonicalEvent) => event.id;
const key = "id" as const;
export interface Ref {
  [key]: string;
}
`;

const HEADER = `import type { CanonicalEvent, Dates, IsoDay, Text } from "../events";
import { ExactDates, isoDay, join, save, text } from "../events";
declare const raw: unknown;
declare const s: string;
export const event: CanonicalEvent = join(text("t")!, { kind: "approximate", month: 4 });
export const keep = [isoDay, join, save, text, ExactDates, event, s];
`;

const flagged: Record<string, string> = {
  P01: "export const e: CanonicalEvent = raw as never;",
  P02: "declare function cast<T>(value: unknown): T;\nexport const e = cast<CanonicalEvent>(raw);",
  P03: 'declare const kv: { get<T>(key: string, type: "json"): Promise<T | null> };\nexport const e = kv.get<CanonicalEvent>("k", "json");',
  P04: "export const e: CanonicalEvent = JSON.parse(s);",
  P05: "export const e = raw as ReturnType<typeof join>;",
  P06: "export const e = raw as Parameters<typeof join>[0];",
  P07: "declare const x: CanonicalEvent;\nexport const e = raw as typeof x & {};",
  P08: 'type Box = { value: CanonicalEvent };\nexport const e = raw as Box["value"];',
  P09: "export const e = raw as never satisfies CanonicalEvent;",
  P10: 'export const d = { start: "2026-04-10", end: "2026-03-05" } as unknown as ExactDates;',
  P11: 'export const d = "2026-02-30" as IsoDay;',
  P12: 'export const t = "" as Text;',
  P13: "export const d = raw as Dates;",
  P14: 'import type { IsoDay as Day } from "../events";\nexport const d = "2026-02-30" as Day;',
  P15: 'import type { IsoDay as Day } from "../events/model";\nexport const d = "2026-02-30" as Day;',
  P16: 'import type * as Events from "../events";\nexport const d = "2026-02-30" as Events.IsoDay;',
  P17: 'export const d = "2026-02-30" as import("../events").IsoDay;',
  P18: "export function load(json: string): CanonicalEvent {\n  return JSON.parse(json);\n}",
  P19: "export async function load(response: Response) {\n  const e: CanonicalEvent = await response.json();\n  return e;\n}",
  P22: "export const e: CanonicalEvent = raw as any;",
  P23: "export const e: CanonicalEvent = raw as never & { id: string };",
  P24: "type Bottom = never;\nexport const e: CanonicalEvent = raw as Bottom;",
  P25: "export const es: CanonicalEvent[] = [JSON.parse(s)];",
  P29: "export const { e }: { e: CanonicalEvent } = JSON.parse(s);",
  P30: "export const e = JSON.parse(s) satisfies CanonicalEvent;",
  P31: "export function isEvent(value: unknown): value is CanonicalEvent {\n  return value !== null;\n}",
  P33: "export class Store {\n  e: CanonicalEvent = JSON.parse(s);\n}",
  P35: "export function handle(e: CanonicalEvent = JSON.parse(s)) {\n  return e;\n}",
  P39: "declare class Fake implements CanonicalEvent {\n  readonly title: Text;\n  readonly dates: Dates;\n  readonly id: string;\n}\nexport const e = new Fake();",
  P40: "export const e: CanonicalEvent = JSON.parse(s).event;",
  G01: "export function* load(): Generator<CanonicalEvent> {\n  yield JSON.parse(s);\n}",
  G02: "export function load() {\n  let e: CanonicalEvent;\n  const out: CanonicalEvent[] = [];\n  for (e of JSON.parse(s)) out.push(e);\n  return out;\n}",
  G03: "const parse = JSON.parse;\nexport const e: CanonicalEvent = parse(s);",
  R01: "declare global {\n  type EventAlias = CanonicalEvent;\n}\nexport const e = raw as EventAlias;",
  R02: "type Bottom = never | never;\nexport const e: CanonicalEvent = raw as Bottom;",
  R03: "export const e: CanonicalEvent = (raw as { d: never }).d;",
  R04: "export const e: CanonicalEvent = (raw as never[])[0]!;",
  R05: "export const m: Record<string, CanonicalEvent> = raw as Record<string, never>;",
  R06: "export const e: CanonicalEvent = (raw as Record<string, never>).k;",
  R07: "export const make: () => CanonicalEvent = raw as () => never;",
  R08: "export const e: CanonicalEvent = (raw as () => never)();",
  R09: "function forge(x: unknown): ExactDates;\nfunction forge(x: unknown): unknown {\n  return x;\n}\nexport const d = forge(raw);",
  R10: "function id<T>(x: unknown): T {\n  return x as T;\n}\nexport const d: ExactDates = id(raw);",
  R11: "function make<T = Dates>(x: unknown) {\n  return x as T;\n}\nexport const d = make(raw);",
  R12: 'declare function cachedJson<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T>;\nexport const e = cachedJson<CanonicalEvent>("k", 1, async () => JSON.parse(s));',
  R13: 'const memo = new Map<string, unknown>();\nasync function cachedJson<T>(key: string, load: () => Promise<T>): Promise<T> {\n  return (memo.get(key) as T | undefined) ?? load();\n}\nexport const e = cachedJson("k", async () => event);',
  R14: "export const d = Object.assign({}, ExactDates.of(isoDay(s)!, isoDay(s)!)!, { start: isoDay(s)! });",
  R15: "export const d: ExactDates = Object.create(ExactDates.prototype);",
  R16: "declare const e: CanonicalEvent;\nexport const out = e;",
  R17: "export class Store {\n  e!: CanonicalEvent;\n}",
  R18: "export declare function mint(): CanonicalEvent;",
  R19: "export const e = structuredClone(raw) as CanonicalEvent;",
  R20: "export const e: CanonicalEvent = { title: s, dates: raw, id: s } as any;",
  R21: "export const e: CanonicalEvent = (raw as { [key: string]: never }).k;",
  R22: 'function readStore<T>(key: string): T | undefined {\n  return key ? JSON.parse(key) : undefined;\n}\nasync function cachedJson<T>(key: string, load: () => Promise<T>) {\n  return readStore<T>(key) ?? (await load());\n}\nexport const e = cachedJson("k", async () => event);',
  R24: "export const e = Object.assign({ ...event }, { title: s });",
  R25: "declare const Factory: new () => ExactDates;\nexport const d = new Factory();",
  R26: "export const Factory = raw as new () => ExactDates;",
  R27: 'import type { Sealed } from "../events";\nexport const x = raw as Sealed;',
  R28: 'import { make } from "fake-lib";\nexport const e = make<CanonicalEvent>();',
  R29: 'import { seeded } from "fake-lib";\nexport const e = seeded<CanonicalEvent>();',
  R30: 'import { tag } from "fake-lib";\nexport const e = tag<CanonicalEvent>`x`;',
  R31: "Object.assign(event, JSON.parse(s));",
  R32: 'import { is } from "fake-lib";\nexport const out = is<CanonicalEvent>(raw) ? save(raw) : null;',
  R33: 'import { assertIs } from "fake-lib";\nassertIs<CanonicalEvent>(raw);\nexport const out = save(raw);',
  R34: "declare const key: unique symbol;\nexport class Store {\n  [key]!: CanonicalEvent;\n}",
  R36: "interface A { b: B; event: CanonicalEvent }\ninterface B { a: A }\nexport const c = (a: A) => structuredClone(a);\nexport const x = raw as B;",
  R37: 'import { payload } from "fake-lib";\nexport const box: { event: CanonicalEvent } = payload;',
  R38: "export const events: CanonicalEvent[] = [...JSON.parse(s)];",
  R39: "declare function saveAll(...events: CanonicalEvent[]): void;\nsaveAll(...JSON.parse(s));",
  R40: "declare class Registry {\n  static event: CanonicalEvent;\n}\nexport const e = Registry.event;",
  R42: "function relabel<T>(seed: T, x: unknown): T {\n  return seed && (x as T);\n}\nexport const e = relabel(event, raw);",
  R43: 'import { relabel } from "../lib/relabel";\nexport const e = relabel(event, raw);',
  R41: "export function process<T extends CanonicalEvent>(event: T = JSON.parse(s)) {\n  return save(event);\n}",
  R44: 'import { morph } from "fake-lib";\nexport const e = morph<CanonicalEvent>(JSON.parse(s), isoDay(s)!);',
  R45: "declare function morph<T>(value: unknown, proof: unknown): T;\nexport const e = morph<CanonicalEvent>(raw, isoDay(s)!);",
  R46: "function bad<T>(seed: T): T {\n  let result!: T;\n  return seed && result;\n}\nexport const e = bad(event);",
  R47: 'export function process<T extends { event: CanonicalEvent }>(event: T["event"] = JSON.parse(s)) {\n  return save(event);\n}',
  R48: "function fake(): never {\n  return undefined!;\n}\nexport const e: CanonicalEvent = fake();",
  R49: 'import { make } from "fake-lib";\nfunction bad<T>(seed: T): T {\n  void seed;\n  return make<T>();\n}\nexport const e = bad(event);',
  R50: "export class Registry {\n  static event: CanonicalEvent;\n}",
  R51: 'import { seeded } from "fake-lib";\nexport const e = seeded<CanonicalEvent>(undefined);',
  R52: 'function fake(): never {\n  return undefined!;\n  throw new Error("unreachable");\n}\nexport const e: CanonicalEvent = fake();',
  R53: 'import { is } from "fake-lib";\nconst list = [event];\nexport const out = is<CanonicalEvent>(list) ? save(list) : null;',
  R54: "interface Source {\n  make<T>(): T;\n}\nfunction bad<T>(seed: T, source: Source): T {\n  void seed;\n  return source.make<T>();\n}\nexport const e = (source: Source) => bad(event, source);",
  R35: `type Many = ${Array.from({ length: 2600 }, (_, i) => `{ a${i}: ${i} }`).join(" | ")} | { last: CanonicalEvent };\nexport const e = raw as Many;`,
  C01: "export const load: () => CanonicalEvent = () => JSON.parse(s);",
  C02: "export class Store {\n  e: CanonicalEvent;\n  constructor() {\n    this.e = JSON.parse(s);\n  }\n}",
  C03: 'export async function load() {\n  const Events = await import("../events");\n  return raw as ReturnType<typeof Events.join>;\n}',
  C04: "export async function load(response?: Response) {\n  const e: CanonicalEvent | undefined = await response?.json();\n  return e;\n}",
  C06: "function parse(x: string): CanonicalEvent;\nfunction parse(x: unknown) {\n  return x;\n}\nexport const e = parse(s);",
  R55: 'type Loose = { tag: "a"; value: any } | { tag: "b"; value: string };\ntype Owned = { tag: "c"; value: CanonicalEvent } | { tag: "d"; value: CanonicalEvent };\nexport const e: Owned = raw as Loose;',
  R56: "type Source = { (): any; (x: string): any };\nconst loose = raw as Source;\nexport const make: () => CanonicalEvent = loose;",
  R57: 'type Owned = { tag: "owned"; value: CanonicalEvent };\nexport function pass(input: Owned | { tag: any; value: any }) {\n  const out: Owned | { tag: "other"; value: string } = input;\n  return out;\n}',
  R58: "const payload = { event: JSON.parse(s) };\nexport const events: Record<string, CanonicalEvent> = payload;",
  Y10: "declare const a: Array<any>;\nexport const r: Iterable<CanonicalEvent> = a;",
  Y01: "declare function count(es: Iterable<CanonicalEvent>): number;\nexport const n = count(new Set<any>(JSON.parse(s)));",
  Y02: "declare const t: [any, any];\nexport const xs: readonly CanonicalEvent[] = t;",
  Y03: "declare const m: Map<string, any>;\ndeclare function take(it: Iterable<readonly [string, CanonicalEvent]>): void;\ntake(m);",
  X05: "type Source = { (x: string): string; (): any };\nconst loose = raw as Source;\nexport const make: { (): CanonicalEvent; (x: string): string } = loose;",
  X07: "type Source = { (x: number): any };\nconst loose = raw as Source;\nexport const make: (x: string) => CanonicalEvent = loose;",
  Z01: 'type Owned = { tag: "owned"; value: CanonicalEvent };\ntype Other = { tag: "other"; value: string };\nexport function pass(input: Owned | { tag: any; value: any }) {\n  const out: Other | Owned = input;\n  return out;\n}',
  Z02: "declare const p: Promise<any>;\nexport const e: Promise<CanonicalEvent> = p;",
  Z10: "declare const arr: Array<any>;\nexport const xs: ReadonlyArray<CanonicalEvent> = arr;",
  Z03: "const payload = { 0: JSON.parse(s) };\nexport const events: Record<number, CanonicalEvent> = payload;",
  Z04: 'declare const value: { tag: any; value: any };\nexport const out: { tag: "a"; value: CanonicalEvent } | { tag: "b"; value: CanonicalEvent } = value;',
  Z05: "type Box = CanonicalEvent & { readonly extra: true };\ndeclare const value: { leak: any };\nexport const boxed: Box = value;",
  Z08: "type Source = { new (): any };\ntype Target = { new (): CanonicalEvent };\ndeclare const Factory: Source;\nexport const make: Target = Factory;",
  K2: "type Source = { (): any; (x: string): string };\ntype Target = { (x: string): CanonicalEvent; (): string };\nexport function pass(loose: Source) {\n  const make: Target = loose;\n  return make;\n}",
  K6: "type Source = { (x: string): CanonicalEvent; (x: string | boolean): any };\ntype Target = { (x: string): CanonicalEvent; (x: boolean): string };\nexport function pass(loose: Source) {\n  const make: Target = loose;\n  return make;\n}",
  K7: "type Source = { (): CanonicalEvent; (x: string): any };\ntype Target = () => CanonicalEvent;\nexport function pass(loose: Source) {\n  const make: Target = loose;\n  return make;\n}",
  Q01: "declare const a: any[];\nexport const r: { [n: number]: CanonicalEvent } = a;",
  Q02: "declare const a: any[];\nexport const r: Record<number, CanonicalEvent> = a;",
  Q03: "declare const a: Array<any>;\nexport const r: { readonly length: number; readonly [n: number]: CanonicalEvent } = a;",
  Q04: "declare const m: Map<string, any>;\nexport const r: { get(k: string): CanonicalEvent | undefined } = m;",
  Q05: "declare const it: { [Symbol.iterator](): Iterator<any> };\nexport const r: Iterable<CanonicalEvent> = it;",
  Q06: "interface Bag {\n  [Symbol.iterator](): Iterator<any>;\n}\ndeclare const b: Bag;\nexport const r: Iterable<CanonicalEvent> = b;",
  Q07: "declare const o: { [n: number]: any; length: number };\nexport const r: ArrayLike<CanonicalEvent> = o;",
  F9a: "interface Loose<T> {\n  meta: T;\n  value: any;\n}\ninterface Owned<T> {\n  meta: T;\n  value: CanonicalEvent;\n}\nexport function pass(input: Loose<string>) {\n  const out: Owned<string> = input;\n  return out;\n}",
  F9b: "interface Holder<T> {\n  item: T;\n  extra: any;\n}\ninterface Slot<T> {\n  item: T;\n  extra: CanonicalEvent;\n}\ndeclare const h: Holder<number>;\nexport const out: Slot<number> = h;",
  F9c: "class Loose2<T> {\n  constructor(\n    readonly meta: T,\n    readonly value: any,\n  ) {}\n}\ninterface Owned2<T> {\n  meta: T;\n  value: CanonicalEvent;\n}\ndeclare const l: Loose2<string>;\nexport const o2: Owned2<string> = l;",
  F10a: "export function pass(input: { [k: string]: any }) {\n  const out: { [k: number]: CanonicalEvent } = input;\n  return out;\n}",
  F10b: "declare const m: Record<string, any>;\nexport const r: Record<number, CanonicalEvent> = m;",
  F10c: "const key = Symbol();\nexport function pass2(input: { [key]: any }) {\n  const out: { [k: symbol]: CanonicalEvent } = input;\n  return out;\n}",
  F9d: 'interface Mine<T> {\n  status: "fulfilled";\n  value: any;\n  tag: T;\n}\nexport function pass(m: Mine<CanonicalEvent>) {\n  const r: PromiseFulfilledResult<CanonicalEvent> = m;\n  return r;\n}',
  F11d: "export const make: { new (): CanonicalEvent[] } = Array;",
  C1a: "export function pass(input: { [k: number]: any }) {\n  const out: { [k: string]: CanonicalEvent } = input;\n  return out;\n}",
  C2a: "export function pass(input: { '-1': any }) {\n  const out: Record<number, CanonicalEvent> = input;\n  return out;\n}",
  C2b: "export function pass(input: { '1.5': any }) {\n  const out: Record<number, CanonicalEvent> = input;\n  return out;\n}",
  C2c: "export function pass(input: { 'event-a': any }) {\n  const out: { [k: `event-${string}`]: CanonicalEvent } = input;\n  return out;\n}",
  C2d: "export function pass(input: { [k: string]: any }) {\n  const out: { [k: `event-${string}`]: CanonicalEvent } = input;\n  return out;\n}",
  C2f: "export function pass(input: { [k: `event-${string}`]: any }) {\n  const out: { [k: string]: CanonicalEvent } = input;\n  return out;\n}",
  C3d: "export function pass(input: { (...x: string[]): any; (x: string): CanonicalEvent }) {\n  const out: { (x: string): CanonicalEvent; (x: string, y: string): string } = input;\n  return out;\n}",
  C4g: "export async function pass(input: Promise<any>[]) {\n  let event: CanonicalEvent;\n  for await (event of input) save(event);\n}",
  C3a: "export function pass(input: { (x?: string): any; (): CanonicalEvent }) {\n  const out: { (): CanonicalEvent; (x: string): string } = input;\n  return out;\n}",
  C3b: "export function pass(input: { (...x: string[]): any; (): CanonicalEvent }) {\n  const out: { (): CanonicalEvent; (x: string): string } = input;\n  return out;\n}",
  C4a: "export function pass(input: any[]) {\n  let event: CanonicalEvent;\n  for (event of input) save(event);\n}",
  C4b: "export async function pass(input: AsyncIterable<any>) {\n  let event: CanonicalEvent;\n  for await (event of input) save(event);\n}",
  C4c: "export function pass(input: any[] | Set<any>) {\n  let event: CanonicalEvent;\n  for (event of input) save(event);\n}",
  C5a: "export function pass(input: { [k: string]: any }) {\n  const out: { event?: CanonicalEvent } = input;\n  return out;\n}",
  C5b: "export async function pass(input: AsyncIterable<any> | any[]) {\n  let event: CanonicalEvent;\n  for await (event of input) save(event);\n}",
  C5c: "export function pass(input: { [Symbol.iterator](): any }) {\n  let event: CanonicalEvent;\n  for (event of input) save(event);\n}",
  C6a: "export function pass(input: { [Symbol.iterator]: any }) {\n  let event: CanonicalEvent;\n  for (event of input) save(event);\n}",
  C6b: "export function pass(input: { [Symbol.iterator](): { next: any } }) {\n  let event: CanonicalEvent;\n  for (event of input) save(event);\n}",
  C6c: "export function pass(input: { [k: `event-${string}`]: any }) {\n  const out: { [k: `${string}-a`]: CanonicalEvent } = input;\n  return out;\n}",
  C6d: "export function collect(input: any[]) {\n  const out: CanonicalEvent[] = [...input];\n  return out;\n}",
  C6e: "declare function saveAll(...events: CanonicalEvent[]): void;\nexport function pass(input: any[]) {\n  saveAll(...input);\n}",
  C6f: "export function pass(input: { event: any }) {\n  const out: { event: CanonicalEvent } = { ...input };\n  return out;\n}",
  C7a: "export function pass(input: { then: any }) {\n  const out: PromiseLike<CanonicalEvent> = input;\n  return out;\n}",
  C7b: "export function pass(input: { subscribe: any }) {\n  const out: { subscribe(listener: (event: CanonicalEvent) => void): void } = input;\n  return out;\n}",
  C8a: "export async function pass(input: { asyncIterator(): Iterator<CanonicalEvent>; [Symbol.iterator](): Iterator<any> }) {\n  let event: CanonicalEvent;\n  for await (event of input) save(event);\n}",
  C9a: "interface Stream<T> {\n  subscribe(listener: (event: T) => void): void;\n}\nexport function pass(input: Stream<any>) {\n  const out: Stream<CanonicalEvent> = input;\n  return out;\n}",
  C9c: "interface Stream<T> {\n  subscribe(listener?: (event: T) => void): void;\n}\nexport function pass(input: Stream<any>) {\n  const out: Stream<CanonicalEvent> = input;\n  return out;\n}",
  C10a: 'export function pass(input: { (x: "raw"): any; (x: string): CanonicalEvent }) {\n  const out: { (x: string): CanonicalEvent; (x: "raw"): string } = input;\n  return out;\n}',
  C10c: 'export function pass(input: { (x: "a" | "b"): any; (x: string): CanonicalEvent }) {\n  const out: { (x: "b" | "c"): CanonicalEvent; (x: "a"): string } = input;\n  return out;\n}',
  KA: "export function pass(input: { [k: `${number}`]: any }) {\n  const out: { [k: string]: CanonicalEvent } = input;\n  return out;\n}",
  KB: "export function pass(input: { [k: string]: any }) {\n  const out: { [k: `${number}`]: CanonicalEvent } = input;\n  return out;\n}",
  NN: "export function pass(input: { [k: number]: any }) {\n  const out: { 1?: CanonicalEvent } = input;\n  return out;\n}",
  NS: "const key = Symbol();\nexport function pass(input: { [k: symbol]: any }) {\n  const out: { [key]?: CanonicalEvent } = input;\n  return out;\n}",
  FC: "export function pass(input: { make: any }) {\n  const out: { make: new (cb: (event: CanonicalEvent) => void) => object } = input;\n  return out;\n}",
  NW: "class Bag {\n  constructor(...events: CanonicalEvent[]) {\n    events.forEach(save);\n  }\n}\nexport function pass(input: any[]) {\n  return new Bag(...input);\n}",
  F12R1:
    "interface Stream<T> {\n  subscribe(...listeners: ((event: T) => void)[]): void;\n}\nexport function pass(input: Stream<any>) {\n  const out: Stream<CanonicalEvent> = input;\n  return out;\n}",
  F12R4:
    "interface Stream<T> {\n  subscribe(...listeners: [(event: T) => void]): void;\n}\nexport function pass(input: Stream<any>) {\n  const out: Stream<CanonicalEvent> = input;\n  return out;\n}",
  F12R8:
    "interface Stream<T> {\n  subscribe(listeners: ((event: T) => void)[]): void;\n}\nexport function pass(input: Stream<any>) {\n  const out: Stream<CanonicalEvent> = input;\n  return out;\n}",
  F12R9:
    "interface Stream<T> {\n  subscribe(options: { onEvent: (event: T) => void }): void;\n}\nexport function pass(input: Stream<any>) {\n  const out: Stream<CanonicalEvent> = input;\n  return out;\n}",
  F12R10:
    "interface Stream<T> {\n  subscribe(listener: ((event: T) => void) | string): void;\n}\nexport function pass(input: Stream<any>) {\n  const out: Stream<CanonicalEvent> = input;\n  return out;\n}",
  F12R11:
    "interface Stream<T> {\n  subscribe(listeners: Array<(event: T) => void>): void;\n}\nexport function pass(input: Stream<any>) {\n  const out: Stream<CanonicalEvent> = input;\n  return out;\n}",
  F12R14:
    "interface Tree<T> {\n  on: (event: T) => void;\n  child: Tree<T>;\n}\ninterface Stream<T> {\n  subscribe(tree: Tree<T>): void;\n}\nexport function pass(input: Stream<any>) {\n  const out: Stream<CanonicalEvent> = input;\n  return out;\n}",
  F12R15:
    "interface Box<T> {\n  on: (event: T) => void;\n}\ninterface Stream<T> {\n  subscribe(box: Box<T>): void;\n}\nexport function pass(input: Stream<any>) {\n  const out: Stream<CanonicalEvent> = input;\n  return out;\n}",
  F12R16:
    "interface Stream<T> {\n  subscribe(options: { onEvent: (event: T) => void } & { name: string }): void;\n}\nexport function pass(input: Stream<any>) {\n  const out: Stream<CanonicalEvent> = input;\n  return out;\n}",
  F12R17:
    "interface Stream<T> {\n  subscribe<U extends (event: T) => void>(listener: U): void;\n}\nexport function pass(input: Stream<any>) {\n  const out: Stream<CanonicalEvent> = input;\n  return out;\n}",
  F12R18:
    "interface Stream<T> {\n  subscribe<U extends (event: T) => void>(options: { on: U }): void;\n}\nexport function pass(input: Stream<any>) {\n  const out: Stream<CanonicalEvent> = input;\n  return out;\n}",
  F12R19:
    "interface Stream<T> {\n  subscribe<U extends { on: (event: T) => void }>(options: U): void;\n}\nexport function pass(input: Stream<any>) {\n  const out: Stream<CanonicalEvent> = input;\n  return out;\n}",
  F12R20:
    "interface Stream<T> {\n  subscribe<U extends ((event: T) => void) | string>(listener: U): void;\n}\nexport function pass(input: Stream<any>) {\n  const out: Stream<CanonicalEvent> = input;\n  return out;\n}",
  KT1: "export function pass(input: { [k: `x${string}`]: any }) {\n  const out: { [k: `${string}y`]: CanonicalEvent } = input;\n  return out;\n}",
  KT3: "export function pass(input: { [k: `id-${number}`]: any }) {\n  const out: { [k: `${string}-7`]: CanonicalEvent } = input;\n  return out;\n}",
  KE: "export function pass(input: { [k: `ab${number}`]: any }) {\n  const out: { [k: `a${string}b0`]: CanonicalEvent } = input;\n  return out;\n}",
  KN: "export function pass(input: { [k: `${number}-${string}`]: any }) {\n  const out: { [k: `${string}-x`]: CanonicalEvent } = input;\n  return out;\n}",
  KT4: "export function pass(input: { [k: `a${string}-${string}a`]: any }) {\n  const out: { [k: `a${number}a`]: CanonicalEvent } = input;\n  return out;\n}",
  KT5: "export function pass(input: { [k: `a${string}a${number}a`]: any }) {\n  const out: { [k: `a${string}b${string}a`]: CanonicalEvent } = input;\n  return out;\n}",
  KT6: "export function pass(input: { [k: `a${string}b${string}a`]: any }) {\n  const out: { [k: `a${string}a${number}a`]: CanonicalEvent } = input;\n  return out;\n}",
  KT7: "export function pass(input: { [k: `a${string}a`]: any }) {\n  const out: { [k: `${string}b${number}a`]: CanonicalEvent } = input;\n  return out;\n}",
  CX1: "export function pass(input: { subscribe(listener: any): void }) {\n  const out: { subscribe(listener: (event: CanonicalEvent) => void): void } = input;\n  return out;\n}",
  CX2: "export function pass(input: { subscribe(o: { onEvent: any }): void }) {\n  const out: { subscribe(o: { onEvent: (event: CanonicalEvent) => void }): void } = input;\n  return out;\n}",
  CX3: "export function pass(input: { subscribe(o: any): void }) {\n  const out: { subscribe(o: { onEvent: (event: CanonicalEvent) => void }): void } = input;\n  return out;\n}",
  CX4: "export function pass(input: { subscribe(o: [any]): void }) {\n  const out: { subscribe(o: [(event: CanonicalEvent) => void]): void } = input;\n  return out;\n}",
  CX7: "export function pass(input: { subscribe(a: any, b: (event: any) => void): void }) {\n  const out: { subscribe(a: any, b: (event: CanonicalEvent) => void): void } = input;\n  return out;\n}",
  CX8: "export function pass(input: { subscribe(o: any): void }) {\n  const out: { subscribe(o: [(event: CanonicalEvent) => void]): void } = input;\n  return out;\n}",
  F12R21:
    "interface Stream<T> {\n  subscribe(listeners: Record<string, (event: T) => void>): void;\n}\nexport function pass(input: Stream<any>) {\n  const out: Stream<CanonicalEvent> = input;\n  return out;\n}",
  F12R22:
    "interface Stream<T> {\n  subscribe(listeners: { [k: number]: (event: T) => void }): void;\n}\nexport function pass(input: Stream<any>) {\n  const out: Stream<CanonicalEvent> = input;\n  return out;\n}",
  CX9: "export function pass(input: { subscribe(o: any): void }) {\n  const out: { subscribe(o: Record<string, (event: CanonicalEvent) => void>): void } = input;\n  return out;\n}",
  KC1: "interface Src<T> {\n  subscribe(o: { on: (event: T) => void }): void;\n}\ninterface Tgt<T> {\n  subscribe(o: Record<string, (event: T) => void>): void;\n}\nexport function pass(input: Src<any>) {\n  const out: Tgt<CanonicalEvent> = input;\n  return out;\n}",
  KC2: "interface Src<T> {\n  subscribe(o: Record<string, (event: T) => void>): void;\n}\ninterface Tgt<T> {\n  subscribe(o: { on: (event: T) => void }): void;\n}\nexport function pass(input: Src<any>) {\n  const out: Tgt<CanonicalEvent> = input;\n  return out;\n}",
  KC3: "interface Src<T> {\n  subscribe(o: { [k: number]: (event: T) => void }): void;\n}\ninterface Tgt<T> {\n  subscribe(o: Record<string, (event: T) => void>): void;\n}\nexport function pass(input: Src<any>) {\n  const out: Tgt<CanonicalEvent> = input;\n  return out;\n}",
  KC4: "interface Src<T> {\n  subscribe(o: Record<string, (event: T) => void>): void;\n}\ninterface Tgt<T> {\n  subscribe(o: { [k: number]: (event: T) => void }): void;\n}\nexport function pass(input: Src<any>) {\n  const out: Tgt<CanonicalEvent> = input;\n  return out;\n}",
  KC8: "interface Src<T> {\n  subscribe(o: [(event: T) => void]): void;\n}\ninterface Tgt<T> {\n  subscribe(o: { 0: (event: T) => void }): void;\n}\nexport function pass(input: Src<any>) {\n  const out: Tgt<CanonicalEvent> = input;\n  return out;\n}",
  KC9: "interface Src<T> {\n  subscribe(o: ((event: T) => void)[]): void;\n}\ninterface Tgt<T> {\n  subscribe(o: { [k: number]: (event: T) => void }): void;\n}\nexport function pass(input: Src<any>) {\n  const out: Tgt<CanonicalEvent> = input;\n  return out;\n}",
  KC10: "interface Src<T> {\n  subscribe(o: [(event: T) => void]): void;\n}\ninterface Tgt<T> {\n  subscribe(o: ((event: T) => void)[]): void;\n}\nexport function pass(input: Src<any>) {\n  const out: Tgt<CanonicalEvent> = input;\n  return out;\n}",
  F12R23:
    "interface Stream<T> {\n  subscribe(listeners: Set<(event: T) => void>): void;\n}\nexport function pass(input: Stream<any>) {\n  const out: Stream<CanonicalEvent> = input;\n  return out;\n}",
  KD3: "export function pass(input: { [k: `z${string}`]: any }) {\n  const out: { [k: `z${number}`]: CanonicalEvent } = input;\n  return out;\n}",
  KD4: "export function pass(input: { [k: `${number}`]: any }) {\n  const out: { [k: `${string}.${string}`]: CanonicalEvent } = input;\n  return out;\n}",
  KD5: "export function pass(input: { [k: `${number}`]: any }) {\n  const out: { [k: `-${string}`]: CanonicalEvent } = input;\n  return out;\n}",
  KD6: "export function pass(input: { [k: `${number}`]: any }) {\n  const out: { [k: `+${string}`]: CanonicalEvent } = input;\n  return out;\n}",
  KD7: "export function pass(input: { [k: `${number}`]: any }) {\n  const out: { [k: `${string} `]: CanonicalEvent } = input;\n  return out;\n}",
  CL1: "interface Stream<T> {\n  subscribe(listener: ((label: string) => void) & { onEvent: (event: T) => void }): void;\n}\nexport function pass(input: Stream<any>) {\n  const out: Stream<CanonicalEvent> = input;\n  return out;\n}",
  CL2: "interface Stream<T> {\n  subscribe(listener: ((label: string) => void) & { [k: string]: (event: T) => void }): void;\n}\nexport function pass(input: Stream<any>) {\n  const out: Stream<CanonicalEvent> = input;\n  return out;\n}",
  LR1: 'import type { Loose } from "fake-lib";\nexport function pass(input: Loose<CanonicalEvent>) {\n  const out: PromiseFulfilledResult<CanonicalEvent> = input;\n  return out;\n}',
  KD8: "export function pass(input: { [k: `${number}`]: any }) {\n  const out: { [k: `0${string}1${string}2`]: CanonicalEvent } = input;\n  return out;\n}",
  KD9: "export function pass(input: { [k: `${number}`]: any }) {\n  const out: { [k: `${string}f`]: CanonicalEvent } = input;\n  return out;\n}",
  KD10: "export function pass(input: { [k: `${number}`]: any }) {\n  const out: { [k: `0x${string}`]: CanonicalEvent } = input;\n  return out;\n}",
  CY1: "interface A<T> {\n  b: B<T>;\n  on: (event: T) => void;\n}\ninterface B<T> {\n  a: A<T>;\n}\ninterface Src<T> {\n  m(b: B<T>): void;\n}\ninterface Tgt<T> {\n  n?(a: A<T>): void;\n  m(b: B<T>): void;\n}\nexport function pass(input: Src<any>) {\n  const out: Tgt<CanonicalEvent> = input;\n  return out;\n}",
};

const clean: Record<string, string> = {
  L01: 'const d = isoDay("2026-04-10");\nconst t = text("x");\nexport const e = d && t && join(t, ExactDates.of(d, d) ?? { kind: "approximate", month: 4 });',
  L02: "export const ids = new Map<string, IsoDay>();\nexport const none = [] as unknown[];",
  L03: "function first(es: readonly CanonicalEvent[]): CanonicalEvent | undefined {\n  return es[0];\n}\nexport const e = first([event]);",
  L04: 'function fail(message: string): never {\n  throw new Error(message);\n}\nexport const d: IsoDay = isoDay(s) ?? fail("bad day");',
  L05: "function persist(e: CanonicalEvent, extra: unknown) {\n  return [e, extra];\n}\nexport const out = persist(event, JSON.parse(s));",
  L07: 'async function get(): Promise<CanonicalEvent> {\n  return join(text("x")!, { kind: "approximate", month: 4 });\n}\nexport const e = await get();',
  L08: "export const titles = [event].map((e) => e.title);",
  L09: "class Holder {\n  constructor(readonly e: CanonicalEvent) {}\n}\nclass Store {\n  items: CanonicalEvent[] = [];\n}\nexport const out = [new Holder(event), new Store()];",
  L10: "export const frozen = Object.freeze(event);\nexport const copy = { ...event, title: text(s)! };",
  L11: 'declare function cachedJson<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T>;\nexport const raws = cachedJson<unknown>("k", 1, async () => JSON.parse(s));',
  L12: "export const parsed: unknown = JSON.parse(s);\nexport const label: string = event.title;",
  L14: "export function f() {\n  type Text = { value: string };\n  return raw as Text;\n}",
  L15: "export const list = Promise.resolve<IsoDay[]>([]);\nexport const day = Object.freeze(isoDay(s));",
  L16: "export function read(cache: { json(): CanonicalEvent }) {\n  const e: CanonicalEvent = cache.json();\n  return e;\n}",
  L17: 'import { box } from "fake-lib";\nexport const days = box<IsoDay>();',
  L18: 'export const id = raw as Pick<CanonicalEvent, "id">;',
  L19: "console.log(event, JSON.parse(s));",
  L21: 'import type { Tagged } from "../events";\nexport const t = raw as Tagged;',
  L22: 'import { pass } from "fake-lib";\nexport const e = pass`x${event}`;',
  L20: 'import { isDefined } from "fake-lib";\nexport const out = (maybe?: CanonicalEvent) => (isDefined(maybe) ? save(maybe) : null);',
  L23: "const pick = <T,>(xs: readonly T[]) => xs[0];\nexport const e = pick([event]);",
  L24: 'function settledValues<T>(results: PromiseSettledResult<T>[]): T[] {\n  const values: T[] = [];\n  for (const r of results) if (r.status === "fulfilled") values.push(r.value);\n  return values;\n}\nexport const es = settledValues([{ status: "fulfilled", value: event }]);',
  L25: "async function mapWithConcurrency<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>) {\n  const results = new Array<R>(items.length);\n  let cursor = 0;\n  async function worker() {\n    while (cursor < items.length) {\n      const index = cursor++;\n      results[index] = await fn(items[index]!);\n    }\n  }\n  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));\n  return results;\n}\nexport const es = await mapWithConcurrency([s], 2, async () => event);",
  L26: "function withDeadline<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {\n  return Promise.race([promise.catch(() => fallback), new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);\n}\nexport const e = withDeadline(Promise.resolve(event), 10, event);",
  L27: 'function mergeNonEmpty<T extends object>(prev: T, next: Partial<T>): T {\n  const merged = { ...prev };\n  for (const [key, value] of Object.entries(next)) {\n    if (value === undefined || value === null || value === "") continue;\n    Object.assign(merged, { [key]: value });\n  }\n  return merged;\n}\nexport const e = mergeNonEmpty(event, { id: s });',
  L28: "function g<T>(x: T): T {\n  return x;\n}\nclass Box<T> {\n  constructor(readonly value: T) {}\n}\nexport const out = [g(event), new Box(event)];",
  L29: 'const memo = new Map<string, Promise<unknown>>();\nfunction cachedJson<T>(key: string, load: () => Promise<T>): Promise<T> {\n  const run = load();\n  memo.set(key, run);\n  return run;\n}\nexport const e = cachedJson("k", async () => event);',
  L30: "function walk<T>(x: T, n: number): T {\n  return n ? walk(x, n - 1) : x;\n}\nexport const e = walk(event, 3);",
  L31: "function keepOne(e: CanonicalEvent) {\n  const cast = <T,>(x: unknown) => x as T;\n  return cast<string>(e.id) ? e : e;\n}\nexport const e = keepOne(event);",
  L32: 'import type { Ref } from "../events";\nexport const r = raw as Ref;',
  L33: "interface Holder<T> {\n  get(): T;\n}\nfunction read<T>(holder: Holder<T>): T {\n  return holder.get();\n}\nexport const e = (holder: Holder<CanonicalEvent>) => read(holder);",
  L34: "function apply<T, R>(value: T, fn: (item: T) => R): R {\n  return fn(value);\n}\nexport const e = apply(event, (item) => item);",
  L35: 'function firstFulfilled<T>(results: readonly PromiseSettledResult<T>[]): T | undefined {\n  for (const r of results) if (r.status === "fulfilled") return r.value;\n  return undefined;\n}\nexport const e = firstFulfilled(await Promise.allSettled([Promise.resolve(event)]));',
  L36: 'function firstFulfilled<T>(results: readonly PromiseSettledResult<T>[]): T | undefined {\n  for (const r of results) if (r.status === "fulfilled") return r.value;\n  return undefined;\n}\nexport const e = firstFulfilled(await Promise.allSettled([Promise.resolve(s)]));',
  L37: "function read<T extends CanonicalEvent>(value: CanonicalEvent): T {\n  return value;\n}\nexport const out = read;",
  L38: "interface A { b: B }\ninterface B { a: A; event: CanonicalEvent }\ninterface A2 { b: B2 }\ninterface B2 { a: A2; event: CanonicalEvent }\nexport function copy(value: A): A2 {\n  return value;\n}",
  L39: "const payload = { event };\nexport const events: Record<string, CanonicalEvent> = payload;",
  Z09: "const payload = { 0: event, label: JSON.parse(s) };\nexport const events: Record<number, CanonicalEvent> = payload;",
  N03: "interface Envelope<T> {\n  payload: T;\n  raw: unknown;\n}\nexport const env: Envelope<CanonicalEvent> = { payload: event, raw: JSON.parse(s) };",
  K1: "type Source = { (x: string): any; (): CanonicalEvent };\ntype Target = { (x: string): string; (): CanonicalEvent };\nexport function pass(loose: Source) {\n  const make: Target = loose;\n  return make;\n}",
  K3: 'type Source = { (x: string): CanonicalEvent; (x: number): any };\ntype Target = { (x: "a"): CanonicalEvent; (x: number): string };\nexport function pass(loose: Source) {\n  const make: Target = loose;\n  return make;\n}',
  K4: "type Source = { (x?: number): any; event: CanonicalEvent };\ntype Target = { (): string; event: CanonicalEvent };\nexport function pass(loose: Source) {\n  const make: Target = loose;\n  return make;\n}",
  K5: "type Source = (x?: string) => CanonicalEvent;\ntype Target = () => CanonicalEvent;\nexport function pass(loose: Source) {\n  const make: Target = loose;\n  return make;\n}",
  V06: "const xs: CanonicalEvent[] = [event];\nexport const r: Iterable<CanonicalEvent> = xs;",
  V07: "export const r: Iterable<CanonicalEvent> = new Set([event]);",
  V08: 'export const r: Iterable<readonly [string, CanonicalEvent]> = new Map([["k", event]]);',
  V09: "declare const m: Map<string, any>;\nexport const r: { size: number; ev?: CanonicalEvent } = m;",
  L13: "export type Label = Text;\nexport interface Wider extends CanonicalEvent {\n  readonly extra: true;\n}\nexport const relay = join;",
  F11a: 'export function pass(v: { (): CanonicalEvent; status: "fulfilled"; value: CanonicalEvent; extra: any }) {\n  const r: PromiseFulfilledResult<CanonicalEvent> = v;\n  return r;\n}',
  F11b: 'export function pass(v: { new (): CanonicalEvent; status: "fulfilled"; value: CanonicalEvent; extra: any }) {\n  const r: PromiseFulfilledResult<CanonicalEvent> = v;\n  return r;\n}',
  F11c: 'export function pass(v: { status: "fulfilled"; value: CanonicalEvent; extra: any }) {\n  const r: PromiseFulfilledResult<CanonicalEvent> = v;\n  return r;\n}',
  F10d: "const key = Symbol();\nexport function pass(o: { [key]: any; a: CanonicalEvent }) {\n  const r: { [k: string]: CanonicalEvent } = o;\n  return r;\n}",
  F10e: "export function pass(input: { [k: string]: any }) {\n  const out: { [k: symbol]: CanonicalEvent } = input;\n  return out;\n}",
  C2e: "export function pass(input: { other: any }) {\n  const out: { [k: `event-${string}`]: CanonicalEvent } = input;\n  return out;\n}",
  C3c: "export function pass(input: { (x: string, y: number): any; (): CanonicalEvent }) {\n  const out: { (): CanonicalEvent; (x: string, y: number): string } = input;\n  return out;\n}",
  C4d: "export function pass(input: CanonicalEvent[]) {\n  let event: CanonicalEvent;\n  for (event of input) save(event);\n}",
  C4e: "export function pass(input: Iterable<CanonicalEvent>) {\n  let event: CanonicalEvent;\n  for (event of input) save(event);\n}",
  C4f: "export async function pass(input: AsyncIterable<CanonicalEvent> | Promise<CanonicalEvent>[]) {\n  let event: CanonicalEvent;\n  for await (event of input) save(event);\n}",
  C7c: "export function pass(input: { then: any }) {\n  const out: PromiseLike<string> = input;\n  return out;\n}",
  C8c: "declare const iterator: unique symbol;\nexport function pass(input: { [iterator](): Iterator<any>; [Symbol.iterator](): Iterator<CanonicalEvent> }) {\n  let event: CanonicalEvent;\n  for (event of input) save(event);\n}",
  C9b: "interface Stream<T> {\n  subscribe(listener: (event: T) => void): void;\n}\nexport function pass(input: { subscribe(listener: (event: CanonicalEvent) => void): void }) {\n  const out: Stream<CanonicalEvent> = input;\n  return out;\n}",
  C10b: 'export function pass(input: { (x: "raw"): string; (x: string): CanonicalEvent }) {\n  const out: { (x: string): CanonicalEvent; (x: "raw"): string } = input;\n  return out;\n}',
  C10d: "export function pass(input: { (x: number): any; (x: string): CanonicalEvent }) {\n  const out: { (x: string): CanonicalEvent; (x: number): string } = input;\n  return out;\n}",
  KT2: "export function pass(input: { [k: `event-${string}`]: any }) {\n  const out: { [k: `other-${string}`]: CanonicalEvent } = input;\n  return out;\n}",
  NS2: "const key = Symbol();\nexport function pass(input: { [k: string]: any }) {\n  const out: { [key]?: CanonicalEvent } = input;\n  return out;\n}",
  F12R12:
    "interface Stream<T> {\n  subscribe(...listeners: ((event: T) => void)[]): void;\n}\nexport function pass(input: Stream<string>) {\n  const out: Stream<string> = input;\n  return out;\n}",
  F12R13:
    "interface Stream<T> {\n  subscribe(...listeners: ((event: T) => void)[]): void;\n}\nexport function pass(input: Stream<CanonicalEvent>) {\n  const out: Stream<CanonicalEvent> = input;\n  return out;\n}",
  F12P1:
    "export function pass(input: { subscribe(o: { a: (event: any) => void; b: (event: CanonicalEvent) => void }): void }) {\n  const out: { subscribe(o: { a: (event: string) => void; b: (event: CanonicalEvent) => void }): void } = input;\n  return out;\n}",
  F12P2:
    "export function pass(input: { subscribe(o: [(event: any) => void, (event: CanonicalEvent) => void]): void }) {\n  const out: { subscribe(o: [(event: string) => void, (event: CanonicalEvent) => void]): void } = input;\n  return out;\n}",
  CX5: "export function pass(input: { subscribe(o: { on: any; onEvent: (event: CanonicalEvent) => void }): void }) {\n  const out: { subscribe(o: { on: string; onEvent: (event: CanonicalEvent) => void }): void } = input;\n  return out;\n}",
  CX6: "export function pass(input: { subscribe(listener: any): void }) {\n  const out: { subscribe(listener: (event: string) => void): void } = input;\n  return out;\n}",
  F12P3:
    "export function pass(input: { subscribe(o: { [k: symbol]: (event: any) => void; [k: string]: (event: CanonicalEvent) => void }): void }) {\n  const out: { subscribe(o: { [k: symbol]: (event: string) => void; [k: string]: (event: CanonicalEvent) => void }): void } = input;\n  return out;\n}",
  KC5: "interface Src<T> {\n  subscribe(o: { on: (event: T) => void }): void;\n}\ninterface Tgt<T> {\n  subscribe(o: { [k: `x${string}`]: (event: T) => void }): void;\n}\nexport function pass(input: Src<any>) {\n  const out: Tgt<CanonicalEvent> = input;\n  return out;\n}",
  KC6: "interface Src<T> {\n  subscribe(o: { [k: `a${string}`]: (event: T) => void }): void;\n}\ninterface Tgt<T> {\n  subscribe(o: { [k: `b${string}`]: (event: T) => void }): void;\n}\nexport function pass(input: Src<any>) {\n  const out: Tgt<CanonicalEvent> = input;\n  return out;\n}",
  KC7: "interface Src<T> {\n  subscribe(o: { [k: `x${string}`]: (event: T) => void }): void;\n}\ninterface Tgt<T> {\n  subscribe(o: { on: (event: T) => void }): void;\n}\nexport function pass(input: Src<any>) {\n  const out: Tgt<CanonicalEvent> = input;\n  return out;\n}",
  KC11: "export function pass(input: { subscribe(o: Map<(event: any) => void, (event: CanonicalEvent) => void>): void }) {\n  const out: { subscribe(o: Map<(event: string) => void, (event: CanonicalEvent) => void>): void } = input;\n  return out;\n}",
  KC12: "export function pass(input: { subscribe(o: Set<any>): void }) {\n  const out: { subscribe(o: { add(value: CanonicalEvent): void }): void } = input;\n  return out;\n}",
  KC13: "export function pass(input: { subscribe(o: [any, CanonicalEvent]): void }) {\n  const out: { subscribe(o: [string, CanonicalEvent]): void } = input;\n  return out;\n}",
  KD1: "export function pass(input: { [k: `${number}`]: any }) {\n  const out: { [k: `${string}y`]: CanonicalEvent } = input;\n  return out;\n}",
  KD2: "export function pass(input: { [k: `z${number}`]: any }) {\n  const out: { [k: `${string}z`]: CanonicalEvent } = input;\n  return out;\n}",
  LR2: 'import type { Tight } from "fake-lib";\nexport function pass(input: Tight<CanonicalEvent>) {\n  const out: PromiseFulfilledResult<CanonicalEvent> = input;\n  return out;\n}',
  KD11: "export function pass(input: { [k: `${bigint}`]: any }) {\n  const out: { [k: `${string}y`]: CanonicalEvent } = input;\n  return out;\n}",
  KD12: "export function pass(input: { [k: `y${string}`]: any }) {\n  const out: { [k: `${number}`]: CanonicalEvent } = input;\n  return out;\n}",
};

const isolated = config.find((block) => block.plugins?.["isolated"])?.plugins?.["isolated"];

const intendedClean = [
  "F10d",
  "F10e",
  "F11a",
  "F11b",
  "F11c",
  "C2e",
  "C3c",
  "C4e",
  "C4f",
  "C8c",
  "C10d",
  "K1",
  "K3",
  "K4",
  "KC5",
  "KC6",
  "KC7",
  "KD1",
  "KD2",
  "KD11",
  "KD12",
  "KT2",
  "L35",
  "N03",
  "NS2",
  "V09",
  "Z09",
];

let root: string;
let messages: Map<string, string[]>;
let mainFlags: Set<string>;
let ruleTimes: Map<string, number>;

beforeAll(async () => {
  if (!isolated) throw new Error("eslint.config.js no longer registers the isolated plugin");
  root = mkdtempSync(join(tmpdir(), "owned-types-"));
  const write = (file: string, code: string) => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), code);
  };
  write("events/model.ts", MODEL);
  write("node_modules/fake-lib/package.json", '{"name":"fake-lib","types":"index.d.ts"}');
  write(
    "node_modules/fake-lib/index.d.ts",
    [
      "export declare function make<T>(): T;",
      "export declare function morph<T>(value: unknown, proof: unknown): T;",
      "export declare function box<T>(items?: readonly T[]): T[];",
      "export declare function seeded<T>(seed?: T): T;",
      "export declare function tag<T>(strings: TemplateStringsArray): T;",
      "export declare function is<T>(value: unknown): value is T;",
      "export declare function assertIs<T>(value: unknown): asserts value is T;",
      "export interface Payload { event: any }",
      'export interface Loose<T> { status: "fulfilled"; value: any; meta: T }',
      'export interface Tight<T> { status: "fulfilled"; value: T; meta: string }',
      "export declare function pass<T>(strings: TemplateStringsArray, value: T): T;",
      "export declare const payload: Payload;",
      "export declare function isDefined<T>(value: T | undefined): value is T;",
    ].join("\n"),
  );
  write(
    "lib/relabel.ts",
    "export function relabel<T>(seed: T, x: unknown): T {\n  return seed && (x as T);\n}\n",
  );
  write(
    "lib/fetch-utils.ts",
    readFileSync(join(import.meta.dirname, "../src/lib/fetch-utils.ts"), "utf8"),
  );
  write("events/index.ts", 'export * from "./model";\n');
  write(
    "events/own.ts",
    'import type { IsoDay } from "./model";\nexport const d = "x" as IsoDay;\n',
  );
  write(
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: {
        strict: true,
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        lib: ["ES2022", "DOM"],
        noEmit: true,
        jsx: "preserve",
        skipLibCheck: true,
      },
      include: ["**/*.ts", "**/*.tsx"],
    }),
  );
  for (const [name, code] of Object.entries({ ...flagged, ...clean }))
    write(`probes/${name}.ts`, `${HEADER}${code}\n`);
  write(
    "probes/S01.ts",
    `${HEADER}import { settledValues } from "../lib/fetch-utils";\nexport const es = await settledValues([Promise.resolve(event)]);\n`,
  );
  write(
    "probes/J01.tsx",
    `${HEADER}function Card(props: { e: CanonicalEvent }) {\n  return <p>{props.e.id}</p>;\n}\nexport const card = <Card e={JSON.parse(s)} />;\n`,
  );
  const eslint = new ESLint({
    cwd: root,
    stats: true,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.ts", "**/*.tsx"],
        languageOptions: {
          parser: tseslint.parser,
          parserOptions: { project: "./tsconfig.json", tsconfigRootDir: root },
        },
        plugins: { isolated },
        rules: {
          "isolated/owned-types": [
            "error",
            { modules: [relative(join(import.meta.dirname, ".."), join(root, "events"))] },
          ],
        },
      },
    ],
  });
  const results = await eslint.lintFiles(["probes", "events", "lib"]);
  const baseline = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: [
      ...mainConfig,
      {
        files: ["**/*.ts", "**/*.tsx"],
        languageOptions: {
          parser: tseslint.parser,
          parserOptions: {
            project: "./tsconfig.json",
            tsconfigRootDir: root,
            disallowAutomaticSingleRunInference: true,
          },
        },
        rules: {
          "main/owned-types": [
            "error",
            { modules: [relative(join(import.meta.dirname, ".."), join(root, "events"))] },
          ],
        },
      },
    ],
  });
  mainFlags = new Set(
    (await baseline.lintFiles(["probes"]))
      .filter((result) => result.messages.length > 0)
      .map((result) => relative(join(root, "probes"), result.filePath).replace(/\.tsx?$/, "")),
  );
  ruleTimes = new Map(
    results.map((result) => [
      relative(root, result.filePath).replace(/\.tsx?$/, ""),
      (result.stats?.times.passes ?? []).reduce(
        (total, pass) => total + (pass.rules?.["isolated/owned-types"]?.total ?? 0),
        0,
      ),
    ]),
  );
  messages = new Map(
    results.map((result) => [
      relative(root, result.filePath).replace(/\.tsx?$/, ""),
      result.messages.map(
        ({ ruleId, message, line }) => `${line} ${ruleId ?? "fatal"}: ${message}`,
      ),
    ]),
  );
}, 60_000);

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("isolated/owned-types", () => {
  it("keeps the flagged and clean probe lists", () => {
    expect(Object.keys(flagged).length).toBe(211);
    expect(Object.keys(clean).length).toBe(83);
  });

  const flaggedSeen: string[] = [];
  it.each([...Object.keys(flagged), "J01"])("flags %s", (name) => {
    flaggedSeen.push(name);
    const found = messages.get(`probes/${name}`) ?? [];
    expect(found.length).toBeGreaterThan(0);
    for (const message of found) expect(message).toMatch(/^(?:[7-9]|\d\d) isolated\/owned-types: /);
  });

  it("visits every flagged probe", () => {
    expect(flaggedSeen).toEqual([...Object.keys(flagged), "J01"]);
  });

  const cleanSeen: string[] = [];
  it.each(Object.keys(clean))("passes %s", (name) => {
    cleanSeen.push(name);
    expect(messages.get(`probes/${name}`)).toEqual([]);
  });

  it("visits every clean probe", () => {
    expect(cleanSeen).toEqual(Object.keys(clean));
  });

  it("flags every probe that main's rule flags, unless it is listed as intended clean", () => {
    const opened = [...mainFlags].filter(
      (name) => (messages.get(`probes/${name}`) ?? []).length === 0,
    );
    expect(mainFlags.size).toBeGreaterThan(150);
    expect(opened.sort()).toEqual([...intendedClean].sort());
  });

  it.each(["F12R1", "F12R4", "F12R8", "F12R9", "F12R10", "F12R11"])(
    "reports %s's listener escape as unsafe on the assignment line",
    (name) => {
      expect(messages.get(`probes/${name}`)).toEqual([
        expect.stringMatching(/^11 isolated\/owned-types: An any- or never-typed value/),
      ]);
    },
  );

  it("reports a generic helper's cast where the helper casts, not where an honest caller passes a real value", () => {
    expect(messages.get("probes/R13")).toEqual([expect.stringMatching(/^9 /)]);
    expect(messages.get("probes/R22")).toEqual([expect.stringMatching(/^8 /)]);
    expect(messages.get("probes/R42")).toEqual([expect.stringMatching(/^8 /)]);
    expect(messages.get("probes/R43")).toEqual([expect.stringMatching(/^8 /)]);
    expect(messages.get("lib/relabel")).toEqual([]);
  });

  it("lets a consumer collect events through the real settledValues helper", () => {
    expect(messages.get("probes/S01")).toEqual([]);
    expect(messages.get("lib/fetch-utils")).toEqual([]);
  });

  it("spends under ten seconds of rule time on any one file", () => {
    const slowest = Math.max(...ruleTimes.values());
    expect(ruleTimes.size).toBeGreaterThan(280);
    expect(slowest).toBeGreaterThan(0);
    expect(slowest).toBeLessThan(10_000);
  });

  it("lets the guarded module build its own values", () => {
    expect(messages.get("events/own")).toEqual([]);
    expect(messages.get("events/model")).toEqual([]);
  });
});

describe("template index key overlap", () => {
  const six = "a${string}b${string}c${string}d${string}e${string}f${string}z";
  it.each([
    [six, "a${string}f${string}e${string}d${string}c${string}b${string}z", true],
    [six, "a${string}f${string}e${string}d${string}c${string}b${string}y", false],
  ])("decides %s against %s in under 100 ms", (left, right, overlap) => {
    const file = join(root, `keys-${String(overlap)}.ts`);
    writeFileSync(file, `export type L = \`${left}\`;\nexport type R = \`${right}\`;\n`);
    const program = ts.createProgram([file], { strict: true, noEmit: true });
    const checker = program.getTypeChecker();
    const [l, r] = program
      .getSourceFile(file)!
      .statements.filter(ts.isTypeAliasDeclaration)
      .map((alias) => checker.getTypeFromTypeNode(alias.type));
    const started = performance.now();
    const found = [keysOverlap(checker, l!, r!), keysOverlap(checker, r!, l!)];
    expect(performance.now() - started).toBeLessThan(100);
    expect(found).toEqual([overlap, overlap]);
  });
});
