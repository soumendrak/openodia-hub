import { afterEach, describe, expect, it, vi } from "vitest";

const imageHarness = vi.hoisted(() => ({
  setContent: vi.fn(),
  screenshot: vi.fn(),
  close: vi.fn(),
  newPage: vi.fn(),
  launch: vi.fn(),
  readFileSync: vi.fn(() => '<svg viewBox="0 0 10 10"></svg>'),
}));

vi.mock("node:fs", () => ({
  default: { readFileSync: imageHarness.readFileSync },
  readFileSync: imageHarness.readFileSync,
}));
vi.mock("node:url", () => {
  const fileURLToPath = (url: URL) => url.pathname;
  return { default: { fileURLToPath }, fileURLToPath };
});
vi.mock("playwright", () => ({
  default: { chromium: { launch: imageHarness.launch } },
  chromium: { launch: imageHarness.launch },
}));

describe("Open Graph image renderer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the SVG at social-card dimensions and closes Chromium", async () => {
    imageHarness.newPage.mockResolvedValue({
      setContent: imageHarness.setContent,
      screenshot: imageHarness.screenshot,
    });
    imageHarness.launch.mockResolvedValue({
      newPage: imageHarness.newPage,
      close: imageHarness.close,
    });
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const { main } = await import("../scripts/build-og-image.mjs");
    await main();
    expect(imageHarness.newPage).toHaveBeenCalledWith({ viewport: { width: 1200, height: 630 } });
    expect(imageHarness.setContent).toHaveBeenCalledWith(
      expect.stringContaining('<svg width="1200" height="630" viewBox="0 0 10 10">'),
      { waitUntil: "load" },
    );
    expect(imageHarness.screenshot).toHaveBeenCalledWith({
      path: expect.stringMatching(/openodia-og\.png$/),
      type: "png",
    });
    expect(imageHarness.close).toHaveBeenCalled();
  });

  it("runs main() automatically when executed as the entry script", async () => {
    imageHarness.newPage.mockResolvedValue({
      setContent: imageHarness.setContent,
      screenshot: imageHarness.screenshot,
    });
    imageHarness.launch.mockResolvedValue({
      newPage: imageHarness.newPage,
      close: imageHarness.close,
    });
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const previousArgv1 = process.argv[1];
    process.argv[1] = "/path/to/scripts/build-og-image.mjs";
    vi.resetModules();
    try {
      await import("../scripts/build-og-image.mjs");
      expect(imageHarness.screenshot).toHaveBeenCalled();
      expect(imageHarness.close).toHaveBeenCalled();
    } finally {
      process.argv[1] = previousArgv1;
    }
  });
});
