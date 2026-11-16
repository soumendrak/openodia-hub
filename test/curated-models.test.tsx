import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const hfHarness = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock("../src/lib/fetch-utils", () => ({ fetchWithTimeout: hfHarness.fetch }));
vi.mock("../src/lib/sources/cache", () => ({
  cachedJson: (_key: string, _ttl: number, loader: () => unknown) => loader(),
  UpstreamUnavailableError: class UpstreamUnavailableError extends Error {},
}));

import { CURATED_MODEL_IDS, curatedLicense } from "../src/data/curated-models";
import { loadModels } from "../src/lib/sources/huggingface";
import { ResourceMeta } from "../src/components/ResourceMeta";

const ODIASLM = [
  "arunjmisra2273/OdiaSLM-60M-Base",
  "arunjmisra2273/OdiaSLM-100M-Base",
  "arunjmisra2273/OdiaSLM-100M-Instruct",
];

const entry = {
  name: "OdiaSLM-60M-Base",
  author: "arunjmisra2273",
  url: "https://huggingface.co/arunjmisra2273/OdiaSLM-60M-Base",
  createdAt: "2026-11-11T06:16:12.000Z",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function routeFetch(responses: Record<string, Response>) {
  hfHarness.fetch.mockImplementation((url: string) =>
    Promise.resolve(responses[url] ?? json({ error: "unexpected" }, 500)),
  );
}

afterEach(() => {
  hfHarness.fetch.mockReset();
  cleanup();
});

describe("curated OdiaSLM models", () => {
  it("lists exactly the three OdiaSLM models", () => {
    expect(CURATED_MODEL_IDS).toEqual(ODIASLM);
  });

  it("carries the licence name and terms as written on each Hugging Face card", () => {
    for (const id of ODIASLM.slice(0, 2)) {
      expect(curatedLicense(id)).toEqual({
        name: "cc-by-nc-4.0-with-commercial-option",
        terms:
          "Licensed under CC-BY-NC-4.0 for academic, research, and non-commercial use. Commercial deployments require a separate Commercial License from the author (arunjmisra2273).",
        url: `https://huggingface.co/${id}/blob/main/LICENSE.md`,
        paperUrl: "https://doi.org/10.5281/zenodo.24167433",
      });
    }
    expect(curatedLicense("arunjmisra2273/OdiaSLM-100M-Instruct")).toMatchObject({
      name: "odiaslm-dual-nc-1.0",
      url: "https://huggingface.co/arunjmisra2273/OdiaSLM-100M-Instruct/blob/main/LICENSE",
    });
    expect(curatedLicense("FacebookAI/xlm-roberta-base")).toBeUndefined();
  });

  it("adds curated models the Odia listing missed, sorted by downloads", async () => {
    routeFetch({
      "https://huggingface.co/api/models?filter=or&limit=100&sort=downloads&direction=-1": json([
        { id: "big/model", downloads: 100, tags: [] },
        { id: "arunjmisra2273/odiaslm-100m-base", downloads: 54, tags: [] },
        { id: "small/model", downloads: 1, tags: [] },
      ]),
      "https://huggingface.co/api/models/arunjmisra2273/OdiaSLM-60M-Base": json({
        id: "arunjmisra2273/OdiaSLM-60M-Base",
        pipeline_tag: "text-generation",
        library_name: "transformers",
        downloads: 44,
        likes: 0,
        tags: ["or", "license:other"],
        createdAt: "2026-11-11T06:16:12.000Z",
      }),
      "https://huggingface.co/api/models/arunjmisra2273/OdiaSLM-100M-Instruct": json(
        { error: "gone" },
        404,
      ),
    });

    const page = await loadModels();

    expect(page.items.map((m) => m.id)).toEqual([
      "big/model",
      "arunjmisra2273/odiaslm-100m-base",
      "arunjmisra2273/OdiaSLM-60M-Base",
      "small/model",
    ]);
    expect(page.items[2]).toMatchObject({
      author: "arunjmisra2273",
      name: "OdiaSLM-60M-Base",
      url: "https://huggingface.co/arunjmisra2273/OdiaSLM-60M-Base",
      task: "text-generation",
      license: "other",
      downloads: 44,
    });
    const requested = hfHarness.fetch.mock.calls.map(([url]) => url as string);
    expect(requested).not.toContain(
      "https://huggingface.co/api/models/arunjmisra2273/OdiaSLM-100M-Base",
    );
    expect(requested).toHaveLength(3);
  });

  it("keeps the listing order untouched when every curated model is already listed", async () => {
    routeFetch({
      "https://huggingface.co/api/models?filter=or&limit=100&sort=downloads&direction=-1": json([
        { id: ODIASLM[0], downloads: 1, tags: [] },
        { id: ODIASLM[2], downloads: 2, tags: [] },
        { id: ODIASLM[1], downloads: 3, tags: [] },
      ]),
    });

    const page = await loadModels();

    expect(page.items.map((m) => m.id)).toEqual([ODIASLM[0], ODIASLM[2], ODIASLM[1]]);
    expect(hfHarness.fetch).toHaveBeenCalledTimes(1);
  });

  it("shows the curated licence badge, its terms and the paper link", () => {
    const note = curatedLicense(ODIASLM[0]);
    render(<ResourceMeta license="" licenseNote={note} entry={entry} />);

    const badge = screen.getByRole("link", { name: "cc-by-nc-4.0-with-commercial-option" });
    expect(badge).toHaveAttribute(
      "href",
      "https://huggingface.co/arunjmisra2273/OdiaSLM-60M-Base/blob/main/LICENSE.md",
    );
    expect(badge.getAttribute("title")).toContain("CC-BY-NC-4.0");
    expect(screen.getByRole("link", { name: "Paper" })).toHaveAttribute(
      "href",
      "https://doi.org/10.5281/zenodo.24167433",
    );
    expect(screen.queryByText("No license")).not.toBeInTheDocument();
  });

  it.each([
    [
      "arunjmisra2273/OdiaSLM-60M-Base",
      "cc-by-nc-4.0-with-commercial-option",
      "Licensed under CC-BY-NC-4.0 for academic, research, and non-commercial use. Commercial deployments require a separate Commercial License from the author (arunjmisra2273).",
    ],
    [
      "arunjmisra2273/OdiaSLM-100M-Base",
      "cc-by-nc-4.0-with-commercial-option",
      "Licensed under CC-BY-NC-4.0 for academic, research, and non-commercial use. Commercial deployments require a separate Commercial License from the author (arunjmisra2273).",
    ],
    [
      "arunjmisra2273/OdiaSLM-100M-Instruct",
      "odiaslm-dual-nc-1.0",
      "Released under the OdiaSLM Non-Commercial Research & Educational License v1.0 (LICENSE). Free for academic research, classroom education, personal experimentation, and non-profit cultural preservation.",
    ],
  ])("renders the exact model-card licence sentence as the %s tooltip", (id, name, sentence) => {
    render(<ResourceMeta license="" licenseNote={curatedLicense(id)} entry={entry} />);

    expect(screen.getByRole("link", { name })).toHaveAttribute("title", sentence);
  });

  it("prefers a recognised SPDX licence over the curated note", () => {
    render(<ResourceMeta license="MIT" licenseNote={curatedLicense(ODIASLM[0])} entry={entry} />);

    expect(screen.getByText("MIT")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Paper" })).not.toBeInTheDocument();
  });

  it("keeps the No license badge for models without a curated note", () => {
    render(<ResourceMeta license="" entry={entry} />);

    expect(screen.getByText("No license")).toBeInTheDocument();
  });
});
