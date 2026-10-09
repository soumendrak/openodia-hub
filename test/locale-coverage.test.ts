import { describe, expect, it } from "vitest";
// The real locale files: other suites mock `or`, so check the shipped strings here.
import { en } from "../src/locales/en";
import { or } from "../src/locales/or";

const enKeys = Object.keys(en) as (keyof typeof en)[];

/** `{name}` / `{{name}}` interpolation tokens, sorted so order may differ per language. */
const tokens = (text: string) => (text.match(/\{\{?\s*[\w.]+\s*\}?\}/g) ?? []).sort();

describe("Odia locale coverage", () => {
  it("has exactly the English keys", () => {
    expect(Object.keys(or).sort()).toEqual([...enKeys].sort());
  });

  it.each(enKeys)("%s has a non-empty Odia string with the same placeholders", (key) => {
    const value = or[key];
    expect(typeof value).toBe("string");
    expect(value!.trim()).not.toBe("");
    expect(tokens(value!)).toEqual(tokens(en[key]));
  });

  it("finds interpolation tokens", () => {
    expect(tokens("{b} of {{ a }}")).toEqual(["{b}", "{{ a }}"]);
    expect(tokens("Open search (Cmd+K)")).toEqual([]);
  });
});
