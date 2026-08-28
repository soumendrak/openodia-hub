import { describe, it, expect, vi, afterEach } from "vitest";
import {
  computeFacets,
  toggleSelection,
  toggleValue,
  hasSelection,
  type FacetDef,
  type Selection,
} from "../src/lib/facets";
import { parseConllu, searchTreebank, loadTreebank } from "../src/lib/sources/treebank";

type Row = { name: string; license: string; task: string; tags: string[] };

const rows: Row[] = [
  { name: "a", license: "MIT", task: "translation", tags: ["x"] },
  { name: "b", license: "MIT", task: "asr", tags: ["y"] },
  { name: "c", license: "Apache-2.0", task: "asr", tags: ["x", "y"] },
  { name: "d", license: "Apache-2.0", task: "asr", tags: [] },
  { name: "e", license: "", task: "ocr", tags: ["x"] },
];

const FACETS: FacetDef<Row>[] = [
  { key: "license", title: "License", values: (r) => [r.license] },
  { key: "task", title: "Task", values: (r) => [r.task] },
  { key: "tag", title: "Tag", values: (r) => r.tags },
];

const optionsFor = (result: ReturnType<typeof computeFacets<Row>>, key: string) =>
  Object.fromEntries(result.options[key].map((o) => [o.value, o.count]));

describe("computeFacets", () => {
  it("counts every facet over the whole list when nothing is selected", () => {
    const r = computeFacets(rows, FACETS, {});
    expect(optionsFor(r, "license")).toEqual({ MIT: 2, "Apache-2.0": 2 });
    expect(optionsFor(r, "task")).toEqual({ translation: 1, asr: 3, ocr: 1 });
    expect(r.filtered).toHaveLength(5);
  });

  it("recomputes the other facets when one is selected", () => {
    const r = computeFacets(rows, FACETS, { license: new Set(["MIT"]) });
    // Only the two MIT rows are in scope for the task facet now.
    expect(optionsFor(r, "task")).toEqual({ translation: 1, asr: 1, ocr: 0 });
    expect(r.filtered.map((x) => x.name)).toEqual(["a", "b"]);
  });

  it("holds a facet's own selection out of its own counts", () => {
    // Picking MIT must not zero out Apache-2.0 beside it — within a facet the
    // selection is OR, so its siblings stay selectable.
    const r = computeFacets(rows, FACETS, { license: new Set(["MIT"]) });
    expect(optionsFor(r, "license")).toEqual({ MIT: 2, "Apache-2.0": 2 });
  });

  it("multi-select inside one facet is OR, across facets is AND", () => {
    const both = computeFacets(rows, FACETS, {
      license: new Set(["MIT", "Apache-2.0"]),
    });
    expect(both.filtered).toHaveLength(4);

    const crossed = computeFacets(rows, FACETS, {
      license: new Set(["Apache-2.0"]),
      task: new Set(["asr"]),
    });
    expect(crossed.filtered.map((x) => x.name)).toEqual(["c", "d"]);
  });

  it("handles multi-valued facets", () => {
    const r = computeFacets(rows, FACETS, { tag: new Set(["x"]) });
    expect(r.filtered.map((x) => x.name)).toEqual(["a", "c", "e"]);
  });

  it("applies the search before counting, and narrows the vocabulary", () => {
    const r = computeFacets(rows, FACETS, {}, (x) => x.task === "asr");
    expect(optionsFor(r, "license")).toEqual({ MIT: 1, "Apache-2.0": 2 });
    // "translation" is gone entirely rather than showing as a zero: it was
    // removed by the search, not by a filter the user can back out of.
    expect(optionsFor(r, "task")).toEqual({ asr: 3 });
  });

  it("sorts unreachable options last, even with a custom order", () => {
    const ordered: FacetDef<Row>[] = [
      FACETS[0],
      { ...FACETS[1], order: (a, b) => a.value.localeCompare(b.value) },
    ];
    const r = computeFacets(rows, ordered, { license: new Set(["MIT"]) });
    const values = r.options.task.map((o) => o.value);
    expect(values.slice(0, 2)).toEqual(["asr", "translation"]); // alphabetical
    expect(values.at(-1)).toBe("ocr"); // count 0, pushed to the end
  });

  it("reports the active selections as removable chips", () => {
    const r = computeFacets(rows, FACETS, {
      license: new Set(["MIT"]),
      task: new Set(["asr"]),
    });
    expect(r.active).toEqual([
      { facet: "license", value: "MIT", label: "MIT" },
      { facet: "task", value: "asr", label: "asr" },
    ]);
  });

  /**
   * The property the whole design exists for: a count is a promise.
   *
   *   - With that facet untouched, selecting an option showing (n) returns
   *     exactly n.
   *   - With a value already selected in that facet, adding another widens the
   *     OR, so the total grows *past* n — it never shrinks, and never empties.
   *
   * Either way, a positive count can never lead to a blank page.
   */
  it("never shows a count that selecting would not deliver", () => {
    const selections: Selection[] = [
      {},
      { license: new Set(["MIT"]) },
      { license: new Set(["Apache-2.0"]) },
      { task: new Set(["asr"]) },
      { tag: new Set(["x"]) },
      { license: new Set(["Apache-2.0"]), task: new Set(["asr"]) },
      { license: new Set(["MIT"]), tag: new Set(["y"]) },
      { license: new Set(["MIT"]), task: new Set(["asr"]), tag: new Set(["x", "y"]) },
    ];

    for (const selected of selections) {
      const current = computeFacets(rows, FACETS, selected);
      for (const def of FACETS) {
        const already = selected[def.key]?.size ?? 0;
        for (const option of current.options[def.key]) {
          if (selected[def.key]?.has(option.value)) continue; // toggling *off*
          const after = computeFacets(
            rows,
            FACETS,
            toggleSelection(selected, def.key, option.value),
          );
          const where = `${def.key}=${option.value} showed (${option.count})`;

          if (option.count === 0) continue; // rendered inert; not selectable

          expect(after.filtered.length, `${where} but returned nothing`).toBeGreaterThan(0);
          if (already === 0) {
            expect(after.filtered.length, `${where} but returned ${after.filtered.length}`).toBe(
              option.count,
            );
          } else {
            // OR within the facet: the new value's own rows are added on top.
            expect(
              after.filtered.length,
              `${where} but the result shrank to ${after.filtered.length}`,
            ).toBeGreaterThanOrEqual(option.count);
          }
        }
      }
    }
  });

  it("an unreachable option stays at zero and is never a trap", () => {
    const r = computeFacets(rows, FACETS, { license: new Set(["MIT"]) });
    const ocr = r.options.task.find((o) => o.value === "ocr")!;
    expect(ocr.count).toBe(0);
    // Selecting it anyway would empty the page — which is why the UI renders a
    // zero-count option as inert rather than clickable.
    const after = computeFacets(
      rows,
      FACETS,
      toggleSelection({ license: new Set(["MIT"]) }, "task", "ocr"),
    );
    expect(after.filtered).toHaveLength(0);
  });
});

describe("selection helpers", () => {
  it("toggles without mutating", () => {
    const start: Selection = { license: new Set(["MIT"]) };
    const next = toggleSelection(start, "license", "Apache-2.0");
    expect([...next.license]).toEqual(["MIT", "Apache-2.0"]);
    expect([...start.license]).toEqual(["MIT"]);
    expect([...toggleValue(new Set(["a"]), "a")]).toEqual([]);
  });

  it("knows when anything is selected", () => {
    expect(hasSelection({})).toBe(false);
    expect(hasSelection({ a: new Set() })).toBe(false);
    expect(hasSelection({ a: new Set(["x"]) })).toBe(true);
  });
});

describe("searchTreebank facet counts", () => {
  const corpus = parseConllu(`# sent_id = s1
1\tକ\t_\tNOUN\tN\t_\t0\troot\t_\tTranslit=ka
2\tଖ\t_\tVERB\tV\t_\t1\tobj\t_\tTranslit=kha

# sent_id = s2
1\tଗ\t_\tNOUN\tN\t_\t0\tnsubj\t_\tTranslit=ga

# sent_id = s3
1\tଘ\t_\tADJ\tJJ\t_\t0\troot\t_\tTranslit=gha
`);

  it("counts each part of speech and relation across the corpus", () => {
    const r = searchTreebank(corpus, { q: "", upos: "", deprel: "", limit: 10 });
    expect(Object.fromEntries(r.uposCounts)).toEqual({ NOUN: 2, VERB: 1, ADJ: 1 });
    expect(r.total).toBe(3);
  });

  it("cross-filters the part-of-speech counts by the selected relation", () => {
    const r = searchTreebank(corpus, { q: "", upos: "", deprel: "root", limit: 10 });
    // s1 roots on a NOUN and s3 on an ADJ; the VERB has no root token.
    expect(Object.fromEntries(r.uposCounts)).toEqual({ NOUN: 1, ADJ: 1 });
    expect(r.total).toBe(2);
  });

  it("cross-filters the relation counts by the selected part of speech", () => {
    const r = searchTreebank(corpus, { q: "", upos: "NOUN", deprel: "", limit: 10 });
    expect(Object.fromEntries(r.deprelCounts)).toEqual({ root: 1, nsubj: 1 });
  });

  it("every listed option returns the number of sentences it claims", () => {
    for (const deprel of ["", "root", "nsubj", "obj"]) {
      const base = searchTreebank(corpus, { q: "", upos: "", deprel, limit: 50 });
      for (const [upos, count] of base.uposCounts) {
        const after = searchTreebank(corpus, { q: "", upos, deprel, limit: 50 });
        expect(after.total, `upos=${upos} deprel=${deprel || "any"}`).toBe(count);
      }
    }
  });
});

describe("option ordering and labels", () => {
  it("orders by count desc, then alphabetically", () => {
    const r = computeFacets(rows, FACETS, {});
    expect(r.options.task.map((o) => o.value)).toEqual(["asr", "ocr", "translation"]);
    // MIT and Apache-2.0 both count 2 — the tie breaks on the label, so the
    // row doesn't reshuffle between renders.
    expect(r.options.license.map((o) => o.value)).toEqual(["Apache-2.0", "MIT"]);
  });

  it("shows the label but filters on the value", () => {
    const labelled: FacetDef<Row>[] = [{ ...FACETS[1], label: (v) => v.toUpperCase() }];
    const r = computeFacets(rows, labelled, { task: new Set(["asr"]) });
    expect(r.options.task.map((o) => [o.value, o.label])).toContainEqual(["asr", "ASR"]);
    expect(r.active).toEqual([{ facet: "task", value: "asr", label: "ASR" }]);
    expect(r.filtered.map((x) => x.name)).toEqual(["b", "c", "d"]);
  });

  it("sinks zero-count options under a custom order from either side", () => {
    // Two reachable and two unreachable values, so the comparator sees a zero
    // on the left and on the right whichever way the sort walks the list.
    const ordered: FacetDef<Row>[] = [
      FACETS[0],
      { ...FACETS[2], order: (a, b) => a.value.localeCompare(b.value) },
    ];
    const wide: Row[] = [
      ...rows,
      { name: "f", license: "MIT", task: "asr", tags: ["a", "z"] },
      { name: "g", license: "GPL-3.0", task: "asr", tags: ["b", "w"] },
    ];
    const r = computeFacets(wide, ordered, { license: new Set(["GPL-3.0"]) });
    const zeros = r.options.tag.filter((o) => o.count === 0).map((o) => o.value);
    const live = r.options.tag.filter((o) => o.count > 0).map((o) => o.value);
    expect(live).toEqual(["b", "w"]); // alphabetical among the reachable
    expect(zeros).toEqual(["a", "x", "y", "z"]); // alphabetical, all after them
    expect(r.options.tag.map((o) => o.value)).toEqual([...live, ...zeros]);
  });
});

describe("parseConllu", () => {
  const raw = [
    "# sent_id = s1",
    "# text = କ ଖ ।",
    "# translit = ka kha .",
    "# text_en = a b.",
    "# a bare comment with no key",
    "# newpar = a key CoNLL-U defines but this parser does not surface",
    "1-2\tକଖ\t_\t_\t_\t_\t_\t_\t_\t_",
    "1\tକ\t_\tNOUN\tN\tCase=Nom\t0\troot\t_\tTranslit=ka",
    "2\tଖ\t_\tNOUN\tN\t_\t1\tconj\t_\t_",
    "3\t।\t_\tPUNCT\tY\t_\t1\tpunct\t_\tTranslit=.",
    "1.1\t_\t_\t_\t_\t_\t_\t_\t_\t_",
    "truncated\tline",
    "",
    "# sent_id = s2",
    "1\tଗ\t_\tVERB\tV\t_\t0\troot\t_\tTranslit=ga",
    "",
  ].join("\n");
  const corpus = parseConllu(raw);

  it("keeps the sentence metadata", () => {
    expect(corpus.sentences.map((s) => s.sentId)).toEqual(["s1", "s2"]);
    expect(corpus.sentences[0].text).toBe("କ ଖ ।");
    expect(corpus.sentences[0].translit).toBe("ka kha .");
    expect(corpus.sentences[0].textEn).toBe("a b.");
  });

  it("skips what is not a token: ranges, empty nodes, short lines, stray comments", () => {
    expect(corpus.tokenCount).toBe(4);
    expect(corpus.sentences[0].tokens.map((t) => t.id)).toEqual([1, 2, 3]);
  });

  it("reads MISC and blanks the underscore placeholders", () => {
    const [k, kh] = corpus.sentences[0].tokens;
    expect(k).toMatchObject({
      form: "କ",
      upos: "NOUN",
      feats: "Case=Nom",
      head: 0,
      translit: "ka",
    });
    // MISC is "_" — no Translit key to find.
    expect(kh).toMatchObject({ feats: "", head: 1, translit: "" });
  });

  it("drops a trailing sentence with no tokens", () => {
    expect(parseConllu("# sent_id = empty\n").sentences).toEqual([]);
  });
});

describe("searchTreebank", () => {
  const corpus = parseConllu(
    [
      "# sent_id = s1",
      "1\tକ\t_\tNOUN\tN\tCase=Nom\t0\troot\t_\tTranslit=ka",
      "2\tଖ\t_\tNOUN\tN\t_\t1\tconj\t_\t_",
      "3\t।\t_\tPUNCT\tY\t_\t1\tpunct\t_\tTranslit=.",
      "",
      "# sent_id = s2",
      "1\tଗ\t_\tVERB\tV\t_\t0\troot\t_\tTranslit=ga",
      "",
    ].join("\n"),
  );
  const query = { q: "", upos: "", deprel: "", limit: 10 };

  it("counts a sentence once however many of its tokens match", () => {
    const r = searchTreebank(corpus, query);
    // s1 holds two NOUNs; the facet says "1 sentence", not "2 tokens".
    expect(Object.fromEntries(r.uposCounts)).toEqual({ NOUN: 1, VERB: 1 });
    expect(Object.fromEntries(r.deprelCounts)).toEqual({ root: 2, conj: 1 });
    expect(r.total).toBe(2);
    expect(r.sentenceCount).toBe(2);
    expect(r.tokenCount).toBe(4);
  });

  it("leaves punctuation out of both facets", () => {
    const r = searchTreebank(corpus, query);
    expect(r.uposCounts.map(([v]) => v)).not.toContain("PUNCT");
    expect(r.deprelCounts.map(([v]) => v)).not.toContain("punct");
  });

  it("holds the part-of-speech selection out of its own counts", () => {
    // Picking NOUN must leave VERB standing beside it, or the facet becomes a
    // one-way door.
    const r = searchTreebank(corpus, { ...query, upos: "NOUN" });
    expect(Object.fromEntries(r.uposCounts)).toEqual({ NOUN: 1, VERB: 1 });
    // The relation counts, though, are narrowed to the NOUN tokens.
    expect(Object.fromEntries(r.deprelCounts)).toEqual({ root: 1, conj: 1 });
    expect(r.total).toBe(1);
  });

  it("holds the relation selection out of its own counts", () => {
    const r = searchTreebank(corpus, { ...query, deprel: "conj" });
    expect(Object.fromEntries(r.deprelCounts)).toEqual({ root: 2, conj: 1 });
    expect(Object.fromEntries(r.uposCounts)).toEqual({ NOUN: 1 });
    expect(r.total).toBe(1);
  });

  it("searches the form, the transliteration and the features", () => {
    expect(searchTreebank(corpus, { ...query, q: "ଗ" }).total).toBe(1);
    expect(searchTreebank(corpus, { ...query, q: " KA " }).total).toBe(1);
    expect(searchTreebank(corpus, { ...query, q: "Case=Nom" }).total).toBe(1);
    expect(searchTreebank(corpus, { ...query, q: "zzz" }).total).toBe(0);
  });

  it("highlights nothing when there are no criteria to highlight", () => {
    expect(searchTreebank(corpus, query).hits.map((h) => h.matches)).toEqual([[], []]);
    expect(searchTreebank(corpus, { ...query, upos: "NOUN" }).hits[0].matches).toEqual([0, 1]);
  });

  it("caps the page of hits without capping the total", () => {
    const r = searchTreebank(corpus, { ...query, limit: 1 });
    expect(r.hits).toHaveLength(1);
    expect(r.total).toBe(2);
  });

  it("keeps only the twenty commonest relations", () => {
    const many = parseConllu(
      Array.from(
        { length: 25 },
        (_, i) => `# sent_id = m${i}\n1\tକ\t_\tNOUN\tN\t_\t0\trel${i}\t_\t_\n`,
      ).join("\n"),
    );
    expect(searchTreebank(many, query).deprelCounts).toHaveLength(20);
    expect(searchTreebank(many, query).uposCounts).toEqual([["NOUN", 25]]);
  });
});

describe("loadTreebank", () => {
  const stub = (init: ResponseInit, body = "") => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(body, init)),
    );
  };
  afterEach(() => vi.unstubAllGlobals());

  it("refuses to cache an upstream failure as an empty treebank", async () => {
    stub({ status: 503 });
    await expect(loadTreebank()).rejects.toThrow("treebank_503");
  });

  it("treats a parse that yields no sentences as unavailable", async () => {
    stub({ status: 200 }, "not conllu at all");
    await expect(loadTreebank()).rejects.toThrow("treebank_empty");
  });

  it("parses and memoizes a good response", async () => {
    stub({ status: 200 }, "# sent_id = s1\n1\tକ\t_\tNOUN\tN\t_\t0\troot\t_\tTranslit=ka\n");
    expect((await loadTreebank()).sentences).toHaveLength(1);
    // Second call is served from the memo — 700 KB is not re-fetched.
    expect(await loadTreebank()).toEqual(await loadTreebank());
    expect(fetch).toHaveBeenCalledOnce();
  });
});
