export type ModelLicenseNote = {
  name: string;
  terms: string;
  url: string;
  paperUrl: string;
};

const ODIASLM_PAPER = "https://doi.org/10.5281/zenodo.24167433";

const ODIASLM_BASE_TERMS =
  "Licensed under CC-BY-NC-4.0 for academic, research, and non-commercial use. Commercial deployments require a separate Commercial License from the author (arunjmisra2273).";

const CURATED_MODELS = new Map<string, ModelLicenseNote>([
  [
    "arunjmisra2273/OdiaSLM-60M-Base",
    {
      name: "cc-by-nc-4.0-with-commercial-option",
      terms: ODIASLM_BASE_TERMS,
      url: "https://huggingface.co/arunjmisra2273/OdiaSLM-60M-Base/blob/main/LICENSE.md",
      paperUrl: ODIASLM_PAPER,
    },
  ],
  [
    "arunjmisra2273/OdiaSLM-100M-Base",
    {
      name: "cc-by-nc-4.0-with-commercial-option",
      terms: ODIASLM_BASE_TERMS,
      url: "https://huggingface.co/arunjmisra2273/OdiaSLM-100M-Base/blob/main/LICENSE.md",
      paperUrl: ODIASLM_PAPER,
    },
  ],
  [
    "arunjmisra2273/OdiaSLM-100M-Instruct",
    {
      name: "odiaslm-dual-nc-1.0",
      terms:
        "Released under the OdiaSLM Non-Commercial Research & Educational License v1.0 (LICENSE). Free for academic research, classroom education, personal experimentation, and non-profit cultural preservation.",
      url: "https://huggingface.co/arunjmisra2273/OdiaSLM-100M-Instruct/blob/main/LICENSE",
      paperUrl: ODIASLM_PAPER,
    },
  ],
]);

export const CURATED_MODEL_IDS: readonly string[] = [...CURATED_MODELS.keys()];

export function curatedLicense(id: string): ModelLicenseNote | undefined {
  return CURATED_MODELS.get(id);
}
