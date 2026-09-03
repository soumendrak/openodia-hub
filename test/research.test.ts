import { describe, it, expect } from "vitest";
import { taskTags } from "../src/lib/sources/papers";
import { parseConllu, searchTreebank } from "../src/lib/sources/treebank";
import { parseReadme } from "../src/lib/sources/awesome";

describe("taskTags", () => {
  it("tags a paper from its title and abstract", () => {
    expect(taskTags("Neural machine translation for Odia")).toContain("Translation");
    expect(taskTags("An ASR system for low-resource Odia speech")).toContain("Speech recognition");
    expect(taskTags("Building a POS tagged corpus for Odia")).toEqual(
      expect.arrayContaining(["POS tagging", "Corpora & resources"]),
    );
  });

  it("returns nothing rather than a wrong tag", () => {
    expect(taskTags("A study of Odia temple architecture")).toEqual([]);
  });
});

describe("parseConllu", () => {
  const sample = `# sent_id = f1-1
# text = ଗୁରୁତର ଅବସ୍ଥାରେ ।
# text_en = In a critical condition.
1\tଗୁରୁତର\t_\tADJ\tJJ\tDegree=Pos\t2\tamod\t_\tTranslit=gurutara
2\tଅବସ୍ଥାରେ\t_\tNOUN\tN_NN\tCase=Loc|Number=Sing\t0\troot\t_\tTranslit=abasthāre
3-4\tskip\t_\t_\t_\t_\t_\t_\t_\t_
3\t।\t_\tPUNCT\tRD_PUNC\t_\t2\tpunct\t_\tTranslit=.

# sent_id = f1-2
# text = ଆନନ୍ଦ ।
1\tଆନନ୍ଦ\t_\tNOUN\tN_NN\tGender=Masc\t0\troot\t_\tTranslit=ānanda
2\t।\t_\tPUNCT\tRD_PUNC\t_\t1\tpunct\t_\tTranslit=.
`;

  it("reads sentences, metadata, and token columns", () => {
    const tb = parseConllu(sample);
    expect(tb.sentences).toHaveLength(2);
    expect(tb.sentences[0].sentId).toBe("f1-1");
    expect(tb.sentences[0].textEn).toBe("In a critical condition.");
    expect(tb.sentences[0].tokens[0]).toMatchObject({
      id: 1,
      form: "ଗୁରୁତର",
      upos: "ADJ",
      head: 2,
      deprel: "amod",
      translit: "gurutara",
    });
  });

  it("skips multiword ranges, which are not tokens", () => {
    const tb = parseConllu(sample);
    expect(tb.sentences[0].tokens.map((t) => t.id)).toEqual([1, 2, 3]);
    expect(tb.tokenCount).toBe(5);
  });

  it("normalises an empty FEATS column", () => {
    expect(parseConllu(sample).sentences[0].tokens[2].feats).toBe("");
  });
});

describe("searchTreebank", () => {
  const corpus = parseConllu(`# sent_id = s1
# text = ଆନନ୍ଦ
1\tଆନନ୍ଦ\t_\tNOUN\tN\tGender=Masc\t0\troot\t_\tTranslit=ānanda

# sent_id = s2
# text = ଗୁରୁତର
1\tଗୁରୁତର\t_\tADJ\tJJ\tDegree=Pos\t0\troot\t_\tTranslit=gurutara
`);

  it("matches on transliteration as well as the Odia form", () => {
    expect(searchTreebank(corpus, { q: "ānanda", upos: "", deprel: "", limit: 10 }).total).toBe(1);
    expect(searchTreebank(corpus, { q: "ଗୁରୁତର", upos: "", deprel: "", limit: 10 }).total).toBe(1);
  });

  it("matches on a morphological feature", () => {
    const r = searchTreebank(corpus, { q: "Degree=Pos", upos: "", deprel: "", limit: 10 });
    expect(r.total).toBe(1);
    expect(r.hits[0].sentence.sentId).toBe("s2");
  });

  it("narrows by part of speech", () => {
    expect(searchTreebank(corpus, { q: "", upos: "NOUN", deprel: "", limit: 10 }).total).toBe(1);
  });

  it("returns every sentence and highlights nothing when unfiltered", () => {
    const r = searchTreebank(corpus, { q: "", upos: "", deprel: "", limit: 10 });
    expect(r.total).toBe(2);
    expect(r.hits[0].matches).toEqual([]);
  });
});

describe("parseReadme", () => {
  it("reads both bullet characters — 41% of the curated list uses '*'", () => {
    const md = `## Models
- [Dash entry](https://github.com/a/b) : first (MIT).
* [Star entry](https://github.com/c/d) : second (Apache-2.0).
`;
    expect(parseReadme(md).map((i) => i.name)).toEqual(["Dash entry", "Star entry"]);
  });

  it("reads HTML anchors, which the Odia-NLP catalog uses throughout", () => {
    const md = `## Text Corpora
* <a href="https://lindat.mff.cuni.cz/x">OdiEnCorp 2.0</a> : 97K English-Odia parallel sentences.
`;
    const [item] = parseReadme(md);
    expect(item.name).toBe("OdiEnCorp 2.0");
    expect(item.url).toBe("https://lindat.mff.cuni.cz/x");
    expect(item.description).toContain("97K English-Odia parallel sentences");
  });

  it("ignores table-of-contents anchors", () => {
    expect(parseReadme("* [Text Corpora](#text-corpora)\n")).toEqual([]);
  });
});

describe("paper deduplication", () => {
  it("collapses records that share a DOI under different titles", async () => {
    const { dedupeForTest } = await import("../src/lib/sources/papers");
    const out = dedupeForTest([
      {
        id: "https://doi.org/10.48550/arXiv.2109.10534",
        title: "Odia Corpus: A Study",
        authors: ["A"],
        year: 2021,
        venue: "arXiv",
        url: "https://arxiv.org/abs/2109.10534",
        abstract: "short",
        openAccess: true,
        tasks: ["Corpora & resources"],
        sources: ["arxiv"],
      },
      {
        id: "https://doi.org/10.48550/arxiv.2109.10534",
        title: "Odia Corpus — A Study",
        authors: ["A", "B"],
        year: 2021,
        venue: "LREC",
        url: "https://doi.org/10.48550/arxiv.2109.10534",
        abstract: "a much longer abstract with more detail",
        openAccess: true,
        tasks: ["Translation"],
        sources: ["openalex"],
      },
    ]);

    expect(out).toHaveLength(1);
    expect(out[0].venue).toBe("LREC");
    expect(out[0].abstract).toContain("longer abstract");
    expect(out[0].authors).toEqual(["A", "B"]);
    expect(out[0].tasks.sort()).toEqual(["Corpora & resources", "Translation"]);
    expect(out[0].sources.sort()).toEqual(["arxiv", "openalex"]);
  });

  it("gives every surviving record a unique id — duplicate React keys drop rows", async () => {
    const { dedupeForTest } = await import("../src/lib/sources/papers");
    const base = {
      authors: [],
      year: 2020,
      venue: "",
      abstract: "",
      openAccess: false,
      tasks: [],
      sources: [],
    };
    const out = dedupeForTest([
      // Same DOI (registrant prefixes are 4-9 digits), different titles.
      { ...base, id: "https://doi.org/10.18653/v1/2020.acl-1", title: "One", url: "u1" },
      {
        ...base,
        id: "https://doi.org/10.18653/V1/2020.ACL-1",
        title: "One but different",
        url: "u2",
      },
      { ...base, id: "arxiv:1", title: "Two", url: "u3" },
      { ...base, id: "arxiv:2", title: "two", url: "u4" },
    ]);
    expect(new Set(out.map((p) => p.id)).size).toBe(out.length);
    expect(out).toHaveLength(2);
  });

  it("keys a record on its title when it has neither an id nor a url to read a DOI from", async () => {
    const { dedupeForTest } = await import("../src/lib/sources/papers");
    const out = dedupeForTest([
      {
        id: "",
        title: "No DOI Paper",
        authors: [],
        year: null,
        venue: "",
        url: "",
        abstract: "",
        openAccess: false,
        tasks: [],
        sources: [],
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("title:no doi paper");
  });

  it("does not let an empty title key a DOI-less record onto an unrelated DOI'd record", async () => {
    const { dedupeForTest } = await import("../src/lib/sources/papers");
    const base = {
      authors: [],
      year: 2022,
      abstract: "",
      openAccess: false,
      tasks: [],
      sources: [],
    };
    const out = dedupeForTest([
      // Title normalises to "" but a valid DOI keys this record — the empty
      // title must not be indexed under it.
      { ...base, id: "https://doi.org/10.1234/with-doi", title: "###", url: "u1", venue: "ACL" },
      // Also has an empty-normalising title, but no DOI at all. If the empty
      // title above had been indexed, this would wrongly merge onto it.
      { ...base, id: "no-doi-id", title: "***", url: "u2", venue: "LREC" },
    ]);
    expect(out).toHaveLength(2);
    expect(out.map((p) => p.venue).sort()).toEqual(["ACL", "LREC"]);
  });

  it("sorts surviving records newest first, treating a missing year as oldest", async () => {
    const { dedupeForTest } = await import("../src/lib/sources/papers");
    const base = {
      authors: [],
      venue: "",
      abstract: "",
      openAccess: false,
      tasks: [],
      sources: [],
    };
    const out = dedupeForTest([
      { ...base, id: "a", title: "A", url: "ua", year: 2010 },
      { ...base, id: "b", title: "B", url: "ub", year: null },
      { ...base, id: "c", title: "C", url: "uc", year: 2020 },
      { ...base, id: "d", title: "D", url: "ud", year: null },
    ]);
    expect(out.map((p) => p.title)).toEqual(["C", "A", "B", "D"]);
  });
});
