import { describe, expect, it } from "vitest";
// The real locale files: other suites mock `or`, so check the shipped strings here.
import { en } from "../src/locales/en";
import { or } from "../src/locales/or";

const enKeys = Object.keys(en) as (keyof typeof en)[];

/** Keys whose Odia string may legitimately equal the English one (e.g. a brand name). */
const SAME_AS_ENGLISH = new Set<string>([]);

/**
 * Interpolation tokens as whole brace runs (`{name}`, `{{ name }}`), plus any stray
 * brace, sorted so word order may differ per language. `{{{name}}}` ≠ `{{name}}`.
 */
const tokens = (text: string) => (text.match(/\{+[^{}]*\}+|[{}]/g) ?? []).sort();

describe("Odia locale coverage", () => {
  it("has exactly the English keys", () => {
    expect(Object.keys(or).sort()).toEqual([...enKeys].sort());
  });

  it.each(enKeys)("%s has a translated Odia string with the same placeholders", (key) => {
    const value = or[key];
    expect(typeof value).toBe("string");
    expect(value!.trim()).not.toBe("");
    if (!SAME_AS_ENGLISH.has(key)) expect(value!.trim()).not.toBe(en[key].trim());
    expect(tokens(value!)).toEqual(tokens(en[key]));
  });

  it("finds interpolation tokens", () => {
    expect(tokens("{b} of {{ a }}")).toEqual(["{b}", "{{ a }}"]);
    expect(tokens("{{{name}}}")).not.toEqual(tokens("{{name}}"));
    expect(tokens("{name")).toEqual(["{"]);
    expect(tokens("Open search (Cmd+K)")).toEqual([]);
  });
});
