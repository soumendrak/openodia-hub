import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// The real locale files: other suites mock `or`, so check the shipped strings here.
import { assessLocale } from "../src/lib/locale-status";
import { en } from "../src/locales/en";
import { or } from "../src/locales/or";
import { ODIA_REVIEW_QUEUE } from "../src/locales/review";

const enKeys = Object.keys(en) as (keyof typeof en)[];

/** Keys whose Odia string must equal the English one (e.g. a brand name). */
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

function assertCoveredTranslation(
  key: string,
  english: string,
  value: string | undefined,
  queue: readonly string[],
) {
  expect(value).toBeDefined();
  if (value === "") {
    expect(queue).toContain(key);
    return;
  }
  expect(typeof value).toBe("string");
  expect(visible(value!)).not.toBe("");
  if (SAME_AS_ENGLISH.has(key)) {
    // An allowlisted string must stay exactly the English one, not drift or typo.
    expect(value).toBe(english);
  } else {
    expect(value!.trim()).not.toBe(english.trim());
    expect(hasOdia(value!), `${key} has no Odia character`).toBe(true);
  }
  expect(tokens(value!)).toEqual(tokens(english));
}

describe("Odia locale coverage", () => {
  it("has exactly the English keys", () => {
    expect(Object.keys(or).every((key) => key in en)).toBe(true);
    expect(new Set(ODIA_REVIEW_QUEUE)).toEqual(new Set(enKeys));
  });

  it.each(enKeys)("%s has a translated Odia string with the same placeholders", (key) => {
    expect(Object.hasOwn(or, key)).toBe(true);
    assertCoveredTranslation(key, en[key], or[key], ODIA_REVIEW_QUEUE);
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

  it("allows a queued blank nav.* placeholder", () => {
    assertCoveredTranslation("nav.new", "New page", "", ["nav.new"]);
    const report = assessLocale({ "nav.new": "New page" }, { "nav.new": "" }, ["nav.new"], {});
    expect(report.errors).toEqual([]);
    expect(report.entries).toEqual([
      { key: "nav.new", english: "New page", translation: "", status: "missing" },
    ]);
  });

  it("requires a blank nav.* placeholder to be in the review queue", () => {
    expect(() => assertCoveredTranslation("nav.new", "New page", "", [])).toThrow(/nav\.new/);
    expect(assessLocale({ "nav.new": "New page" }, { "nav.new": "" }, [], {}).errors).toContain(
      "Untracked English key: nav.new",
    );
  });

  it("documents that a tracked nav.* key may use a blank-string placeholder", () => {
    const contributing = readFileSync("CONTRIBUTING.md", "utf8");
    const start = contributing.indexOf("## Translate one string");
    expect(start).toBeGreaterThan(-1);
    const next = contributing.indexOf("\n## ", start + 1);
    const section = contributing.slice(start, next === -1 ? undefined : next);
    expect(section).toMatch(
      /untranslated tracked keys, including `nav\.\*` keys, must have an explicit blank-string placeholder in `or\.ts`/,
    );
    expect(section).toMatch(/"nav\.[A-Za-z0-9.]+": ""/);
  });
});
