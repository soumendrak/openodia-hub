import { describe, expect, it } from "vitest";
import { licenseFromProse, licenseFromText, normalizeSpdx } from "../src/lib/license";

describe("normalizeSpdx", () => {
  it("keeps unrecognised and non-answers unlabelled", () => {
    for (const raw of ["NOASSERTION", "other", "unknown", "", null, undefined, "made-up-1.0"]) {
      expect(normalizeSpdx(raw)).toBe("");
    }
  });

  it("canonicalises the Hugging Face tag vocabulary", () => {
    expect(normalizeSpdx("bigscience-bloom-rail-1.0")).toBe("BigScience-BLOOM-RAIL-1.0");
    expect(normalizeSpdx("odc-by")).toBe("ODC-By-1.0");
    expect(normalizeSpdx("apache-2.0")).toBe("Apache-2.0");
  });
});

describe("licenseFromText", () => {
  // First lines taken from the LICENSE files GitHub reports as NOASSERTION
  // across the pinned repo list.
  const cases: [string, string][] = [
    ["This Font Software is licensed under the SIL Open Font License, Version 1.1.", "OFL-1.1"],
    ["This Font Software is licensed under the SIL Open Font License, Version 1.0.", "OFL-1.0"],
    ["Apache License\n   Version 2.0, January 2004", "Apache-2.0"],
    ["Attribution-NonCommercial-ShareAlike 4.0 International", "CC-BY-NC-SA-4.0"],
    ["Creative Commons Attribution-NonCommercial 4.0 International Public License", "CC-BY-NC-4.0"],
    [
      "The treebank is licensed under the Creative Commons License Attribution-ShareAlike 4.0 International.",
      "CC-BY-SA-4.0",
    ],
    ["Creative Commons Attribution-ShareAlike 3.0 Unported", "CC-BY-SA-3.0"],
    ["GNU GENERAL PUBLIC LICENSE\n   Version 3, 29 June 2007", "GPL-3.0"],
    ["GNU AFFERO GENERAL PUBLIC LICENSE\n   Version 3, 19 November 2007", "AGPL-3.0"],
    ["MIT License\n\nPermission is hereby granted, free of charge, to any person", "MIT"],
  ];
  it.each(cases)("identifies %s", (text, spdx) => {
    expect(licenseFromText(text)).toBe(spdx);
  });

  it("returns nothing rather than guessing", () => {
    expect(licenseFromText("Copyright 2020 Someone. All rights reserved.")).toBe("");
    expect(licenseFromText("")).toBe("");
  });
});

describe("licenseFromProse", () => {
  it("reads a declared id out of a curated blurb", () => {
    expect(licenseFromProse("An Odia tokenizer (Apache-2.0).")).toBe("Apache-2.0");
    expect(licenseFromProse("Released under the MIT license.")).toBe("MIT");
  });

  it("does not mistake ordinary words for licenses", () => {
    expect(licenseFromProse("A Vim plugin for typing Odia.")).toBe("");
    expect(licenseFromProse("Fine-tuned from Llama3.1 on Odia text.")).toBe("");
    expect(licenseFromProse("Corpus stored in PostgreSQL.")).toBe("");
  });
});
