import { describe, expect, it, vi } from "vitest";

const licenseHarness = vi.hoisted(() => ({
  awesome: vi.fn(),
  resource: vi.fn(),
}));

vi.mock("../src/lib/sources/awesome", () => ({ loadAwesome: licenseHarness.awesome }));
vi.mock("../src/lib/sources/resource", () => ({ loadResource: licenseHarness.resource }));
vi.mock("../src/lib/sources/cache", () => ({
  cachedJson: (_key: string, _ttl: number, loader: () => Promise<unknown>) => loader(),
}));
vi.mock("../src/lib/fetch-utils", () => ({
  mapWithConcurrency: async <T, U>(items: T[], _limit: number, fn: (item: T) => Promise<U>) =>
    Promise.all(items.map(fn)),
}));

describe("Awesome catalog license enrichment", () => {
  it("deduplicates resource refs and omits failed or undeclared licenses", async () => {
    const { loadAwesomeLicenses } = await import("../src/lib/sources/awesome-licenses");
    licenseHarness.awesome.mockResolvedValue([
      { url: "https://github.com/org/repo" },
      { url: "https://github.com/org/repo" },
      { url: "https://huggingface.co/org/model" },
      { url: "https://example.com/page" },
    ]);
    licenseHarness.resource.mockImplementation(async (ref: { kind: string }) => {
      if (ref.kind === "gh") return { license: "MIT" };
      throw new Error("unavailable");
    });

    await expect(loadAwesomeLicenses()).resolves.toEqual({ "/r/gh/org/repo": "MIT" });
    expect(licenseHarness.resource).toHaveBeenCalledTimes(2);
  });
});
