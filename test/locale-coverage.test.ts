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

/** The text with whitespace (including NBSP) and zero-width characters removed. */
const visible = (text: string) => text.replace(/[\s\u200B-\u200D\u2060\uFEFF]/g, "");

/**
 * Whether the text has at least one Odia letter: a letter in the Odia block, so an
 * Odia digit, sign or combining mark alone (`About୦`, `About଼`) doesn't count.
 */
const hasOdia = (text: string) => /(?=[\u0B00-\u0B7F])\p{L}/u.test(text);

describe("Odia locale coverage", () => {
  it("has exactly the English keys", () => {
    expect(Object.keys(or).sort()).toEqual([...enKeys].sort());
  });

  it.each(enKeys)("%s has a translated Odia string with the same placeholders", (key) => {
    const value = or[key];
    expect(typeof value).toBe("string");
    expect(visible(value!)).not.toBe("");
    if (!SAME_AS_ENGLISH.has(key)) {
      expect(value!.trim()).not.toBe(en[key].trim());
      expect(hasOdia(value!), `${key} has no Odia character`).toBe(true);
    }
    expect(tokens(value!)).toEqual(tokens(en[key]));
  });

  it.each(["about", "About.", "Abuot", "About\u0B66", "About\u0B3C", "About\u0B4D"])(
    "rejects %j as an Odia string",
    (value) => {
      expect(hasOdia(value)).toBe(false);
    },
  );

  it.each([
    ["NBSP + ZWSP", "\u00A0\u200B"],
    ["ZWJ + word joiner + BOM", "\u200D\u2060\uFEFF"],
  ])("treats %s as empty", (_, value) => {
    expect(visible(value)).toBe("");
  });

  it("accepts Odia text, including mixed Odia and Latin", () => {
    expect(hasOdia("ପରିଚୟ")).toBe(true);
    expect(hasOdia("ସନ୍ଧାନ ଖୋଲନ୍ତୁ (Cmd+K)")).toBe(true);
    expect(visible("\u00A0ପରିଚୟ\u200B")).toBe("ପରିଚୟ");
  });

  it("finds interpolation tokens", () => {
    expect(tokens("{b} of {{ a }}")).toEqual(["{b}", "{{ a }}"]);
    expect(tokens("{{{name}}}")).not.toEqual(tokens("{{name}}"));
    expect(tokens("{name")).toEqual(["{"]);
    expect(tokens("Open search (Cmd+K)")).toEqual([]);
  });
});
