import type { ComponentType } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { assessLocale, getLocaleStatus } from "../src/lib/locale-status";
import { checkLocaleCoverage } from "../scripts/check-locale-coverage";

const harness = vi.hoisted(() => ({ options: {} as Record<string, unknown> }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => {
    harness.options = options;
    return { options };
  },
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("translation inventory and truthful native-review progress", () => {
  it("reports the real scoped draft inventory without pretending native approval", () => {
    const report = getLocaleStatus();
    expect(report.total).toBeGreaterThanOrEqual(30);
    expect(report.translated).toBe(report.total);
    expect(report.reviewed).toBe(0);
    expect(report.errors).toEqual([]);
    expect(report.scope).toContain("Other page bodies");
    expect(checkLocaleCoverage()).toBe(0);
  });
  it("accepts a tracked missing translation and only an exact-wording native review", () => {
    const result = assessLocale(
      { a: "Home", b: "About", c: "Help" },
      { a: "ମୂଳପୃଷ୍ଠା", b: "ପରିଚୟ", c: "" },
      ["a", "b", "c"],
      {
        a: {
          english: "Home",
          translation: "ମୂଳପୃଷ୍ଠା",
          reviewer: "native-reviewer",
          reviewedAt: "2026-10-12",
        },
        b: {
          english: "About",
          translation: "ପୁରୁଣା",
          reviewer: "native-reviewer",
          reviewedAt: "2026-10-12",
        },
      },
    );
    expect(result.entries.map((entry) => entry.status)).toEqual([
      "reviewed",
      "needs-review",
      "missing",
    ]);
    expect(result.reviewed).toBe(1);
    expect(result.errors).toEqual([]);
  });
  it("invalidates a review when the English source changes", () => {
    const review = {
      english: "Home",
      translation: "ମୂଳପୃଷ୍ଠା",
      reviewer: "native-reviewer",
      reviewedAt: "2026-10-12",
    };
    const status = (english: string) =>
      assessLocale({ a: english }, { a: "ମୂଳପୃଷ୍ଠା" }, ["a"], { a: review }).entries[0].status;
    expect(status("Home")).toBe("reviewed");
    expect(status("Homepage settings")).toBe("needs-review");
  });
  it("rejects unknown and untracked keys, invalid text and mismatched placeholders", () => {
    const report = assessLocale(
      { a: "Hello {name}", b: "About" },
      { a: "ନମସ୍କାର", b: "TODO", extra: "ଅ" },
      ["a", "old"],
      { absent: { english: "", translation: "ଅ", reviewer: "x", reviewedAt: "2026-10-12" } },
    );
    expect(report.errors).toEqual(
      expect.arrayContaining([
        "Unknown tracking key: old",
        "Unknown translation key: extra",
        "Unknown review key: absent",
        "Untracked English key: b",
        "Not an Odia translation: b",
        "Placeholder mismatch: a",
      ]),
    );
    expect(assessLocale({ newKey: "New" }, {}, ["newKey"], {}).errors).toContain(
      "Missing translation placeholder: newKey",
    );
    const output = { log: vi.fn(), error: vi.fn() };
    expect(checkLocaleCoverage(report, output)).toBe(1);
    expect(output.error).toHaveBeenCalledTimes(report.errors.length);
  });
  it.each([
    { english: "About", translation: "ପରିଚୟ", reviewer: "", reviewedAt: "2026-10-12" },
    { english: "About", translation: "ପରିଚୟ", reviewer: "x", reviewedAt: "not-a-date" },
    { english: "About", translation: "ପରିଚୟ", reviewer: "x", reviewedAt: "2026-99-99" },
  ])("does not certify incomplete review evidence %j", (review) => {
    expect(assessLocale({ a: "About" }, { a: "ପରିଚୟ" }, ["a"], { a: review }).reviewed).toBe(0);
  });
  it("allows reordered matching interpolation tokens and empty inventories", () => {
    expect(assessLocale({ a: "{a} and {b}" }, { a: "{b} ଓ {a}" }, ["a"], {}).errors).toEqual([]);
    expect(assessLocale({}, {}, [], {}).total).toBe(0);
  });
  it("runs the CLI entry point with the same inventory validation", async () => {
    const before = process.argv[1];
    const exitCode = process.exitCode;
    process.argv[1] = "scripts/check-locale-coverage.ts";
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      vi.resetModules();
      await import("../scripts/check-locale-coverage");
      expect(process.exitCode).toBe(0);
      expect(log).toHaveBeenCalledWith(expect.stringContaining("46/46"));
    } finally {
      process.argv[1] = before;
      process.exitCode = exitCode;
      vi.resetModules();
    }
  });
});

describe("public translation status API and contributor UX", () => {
  it("renders reviewed and missing strings, excludes reviewed rows, and handles an empty inventory", async () => {
    const locale = await import("../src/lib/locale-status");
    const report = assessLocale(
      { reviewed: "Home", missing: "About" },
      { reviewed: "ମୂଳପୃଷ୍ଠା", missing: "" },
      ["reviewed", "missing"],
      {
        reviewed: {
          english: "Home",
          translation: "ମୂଳପୃଷ୍ଠା",
          reviewer: "fixture-native-reviewer",
          reviewedAt: "2026-10-12",
        },
      },
    );
    const status = vi.spyOn(locale, "getLocaleStatus").mockReturnValue(report);
    const { Route } = await import("../src/routes/translation-status");
    const Page = (Route as unknown as { options: { component: ComponentType } }).options.component;
    render(<Page />);
    expect(screen.getByText("Native-reviewed")).toBeInTheDocument();
    expect(screen.getByText("Translation missing")).toBeInTheDocument();
    expect(screen.getByText("ଅନୁବାଦ ଆବଶ୍ୟକ")).toHaveAttribute("lang", "or");
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.queryByText("Native-reviewed")).toBeNull();
    expect(screen.getByText("1 strings shown")).toBeInTheDocument();
    cleanup();
    status.mockReturnValue(assessLocale({}, {}, [], {}));
    render(<Page />);
    expect(screen.getAllByText("0/0 · 0%")).toHaveLength(2);
    expect(screen.getByText(/No matching strings/)).toBeInTheDocument();
  });

  it("returns JSON with CORS, bounded caching, exact entries and separate counts", async () => {
    const { Route } = await import("../src/routes/api/translation-status");
    const get = (Route as unknown as { options: { server: { handlers: { GET: () => Response } } } })
      .options.server.handlers.GET;
    const response = get();
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("cache-control")).toContain("s-maxage=300");
    const json = await response.json();
    expect(json.total).toBe(46);
    expect(json.reviewed).toBe(0);
    expect(json.entries).toHaveLength(46);
    const { OPENAPI_SPEC } = await import("../src/lib/openapi");
    const { API_CATALOG } = await import("../src/lib/api-discovery");
    expect(OPENAPI_SPEC.paths["/api/translation-status"].get.summary).toContain("native-review");
    expect(
      API_CATALOG.linkset.some((entry) => entry.anchor.endsWith("/api/translation-status")),
    ).toBe(true);
  });
  it("shows scope, distinct progress, searchable strings and accessible contribution links", async () => {
    const { Route } = await import("../src/routes/translation-status");
    const TranslationStatus = (Route as unknown as { options: { component: ComponentType } })
      .options.component;
    expect(
      (Route as unknown as { options: { head: () => { meta: unknown[] } } }).options.head().meta
        .length,
    ).toBeGreaterThan(0);
    render(<TranslationStatus />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Help translate");
    expect(screen.getByText("46/46 · 100%")).toBeInTheDocument();
    expect(screen.getByText("0/46 · 0%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "home.hero.learn" } });
    expect(screen.getByText("1 strings shown")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Edit Odia translation for home.hero.learn" }),
    ).toHaveAttribute("href", expect.stringContaining("/edit/main/src/locales/or.ts"));
    expect(screen.getByText("ଶିଖିବା ଆରମ୍ଭ କରନ୍ତୁ")).toHaveAttribute("lang", "or");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "no-such-translation" } });
    expect(screen.getByText(/No matching strings/)).toBeInTheDocument();
  });
});
