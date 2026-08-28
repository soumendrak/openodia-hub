import { describe, it, expect } from "vitest";
import { isOdiaResult, isLowerBetter, groupBenchmarks } from "../src/lib/sources/leaderboard";
import { taskTags } from "../src/lib/sources/papers";
import { parseConllu, searchTreebank } from "../src/lib/sources/treebank";
import { parseReadme } from "../src/lib/sources/awesome";

describe("isOdiaResult", () => {
  it("finds Odia in the language-code configs MTEB uses", () => {
    // `\bory\b` fails here — "-ory_" has no word boundary after "ory".
    expect(isOdiaResult("MTEB FloresBitextMining (rus_Cyrl-ory_Orya)", "rus_Cyrl-ory_Orya")).toBe(
      true,
    );
    expect(isOdiaResult("Common Voice", "or")).toBe(true);
    expect(isOdiaResult("IndicNLP news", "odia")).toBe(true);
  });

  it("falls back to the dataset name", () => {
    expect(isOdiaResult("Odia sentiment corpus", "")).toBe(true);
    expect(isOdiaResult("Oriya POS", undefined)).toBe(true);
  });

  it("does not match other languages", () => {
    expect(isOdiaResult("MTEB FloresBitextMining (eng_Latn-hin_Deva)", "eng_Latn-hin_Deva")).toBe(
      false,
    );
    expect(isOdiaResult("Amazon reviews", "en")).toBe(false);
  });
});

describe("isLowerBetter", () => {
  it("knows error rates run the other way", () => {
    expect(isLowerBetter("wer")).toBe(true);
    expect(isLowerBetter("CER")).toBe(true);
    expect(isLowerBetter("accuracy")).toBe(false);
    expect(isLowerBetter("chrf")).toBe(false);
  });
});

describe("groupBenchmarks", () => {
  const row = (over: Partial<Parameters<typeof groupBenchmarks>[0][number]>) => ({
    modelId: "a/b",
    modelUrl: "u",
    permalink: "/r/model/a/b",
    task: "Translation",
    dataset: "FLORES",
    config: "",
    split: "devtest",
    metric: "accuracy",
    value: 1,
    verified: false,
    ...over,
  });

  it("sorts higher-is-better descending and error rates ascending", () => {
    const [acc] = groupBenchmarks([
      row({ modelId: "low", value: 10 }),
      row({ modelId: "high", value: 90 }),
    ]);
    expect(acc.rows.map((r) => r.modelId)).toEqual(["high", "low"]);

    const [wer] = groupBenchmarks([
      row({ metric: "wer", modelId: "worse", value: 40 }),
      row({ metric: "wer", modelId: "better", value: 12 }),
    ]);
    expect(wer.lowerIsBetter).toBe(true);
    expect(wer.rows.map((r) => r.modelId)).toEqual(["better", "worse"]);
  });

  it("keeps one score per model — its best for that benchmark", () => {
    const [group] = groupBenchmarks([row({ value: 55 }), row({ value: 71 }), row({ value: 63 })]);
    expect(group.rows).toHaveLength(1);
    expect(group.rows[0].value).toBe(71);
  });

  it("separates different metrics on the same dataset", () => {
    expect(groupBenchmarks([row({ metric: "accuracy" }), row({ metric: "f1" })])).toHaveLength(2);
  });
});

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
});
