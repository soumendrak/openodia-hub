import { afterEach, describe, expect, it, vi } from "vitest";

// `I18nProvider`'s SSR guards (`typeof window === "undefined"`) can only be
// observed by running its internals outside React's own scheduler: react-dom
// unconditionally reads `window.event` while flushing passive effects *and*
// while processing a state update, so deleting the global `window` before a
// real render/update crashes React itself before either guard is ever
// reached. Capturing the raw effect callback (and the `locale` state setter)
// here, then invoking/calling them manually or via a stand-in that never
// touches React's dispatcher, sidesteps that scheduler entirely; every other
// render in this file falls through untouched to the real `useEffect`/
// `useState`.
let capturedI18nEffects: Array<() => void> = [];
let captureI18nEffects = false;
let captureI18nState = false;

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useEffect: (fn: () => void, deps?: unknown[]) => {
      if (captureI18nEffects) {
        capturedI18nEffects.push(fn);
        return;
      }
      return actual.useEffect(fn, deps);
    },
    useState: <T,>(init: T) => {
      if (captureI18nState && init === "en") {
        let value = init;
        const setter = (next: T) => {
          value = next;
        };
        return [value, setter];
      }
      return actual.useState(init);
    },
  };
});

// `or.ts` currently translates every key `en.ts` declares, so no real key can
// exercise the `STRINGS[locale][key] ?? en[key]` fallback in `t()`. Trim the
// Odia locale down to a single key here so a real, meaningful fallback (the
// behavior `i18n.tsx`'s own header comment documents) is observable.
vi.mock("../src/locales/or", () => ({
  or: { "nav.home": "ମୂଳପୃଷ୍ଠା" },
}));

import { act, render, renderHook, screen } from "@testing-library/react";
import React from "react";
import { useIsMobile } from "../src/hooks/use-mobile";
import { apiJson, apiUnavailable } from "../src/lib/api-response";
import { CORS_HEADERS, withCors } from "../src/lib/cors";
import { consumeLastCapturedError } from "../src/lib/error-capture";
import {
  fetchWithTimeout,
  mapWithConcurrency,
  settledValues,
  withDeadline,
} from "../src/lib/fetch-utils";
import { I18nProvider, useTranslation } from "../src/lib/i18n";
import {
  JsonLd,
  authorPerson,
  breadcrumbSchema,
  eventListSchema,
  faqPageSchema,
  itemListSchema,
  serializeJsonLd,
  siteOrganization,
  videoListSchema,
  webSiteSchema,
} from "../src/lib/jsonld";
import { SITE, canonicalUrl, pageHead } from "../src/lib/seo";

describe("public API response helpers", () => {
  afterEach(() => vi.restoreAllMocks());

  it("creates JSON responses with CORS and optional cache metadata", async () => {
    const plain = apiJson({ ok: true }, 201);
    expect(plain.status).toBe(201);
    expect(await plain.json()).toEqual({ ok: true });
    expect(plain.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(plain.headers.get("Cache-Control")).toBeNull();

    const cached = apiJson([1], 200, 60);
    expect(cached.headers.get("Cache-Control")).toContain("s-maxage=60");
    expect(cached.headers.get("X-Cache")).toBeTruthy();
  });

  it("returns useful 503 responses for Error and non-Error failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await apiUnavailable(new Error("offline"), "catalog").json()).toEqual({
      error: "upstream_unavailable",
      reason: "offline",
    });
    expect(await apiUnavailable("offline", "catalog").json()).toEqual({
      error: "upstream_unavailable",
      reason: "unknown",
    });
  });

  it("adds missing CORS headers without overwriting existing values", async () => {
    const wrapped = withCors(
      new Response("body", {
        status: 202,
        statusText: "Accepted",
        headers: { "Access-Control-Allow-Origin": "https://example.com", "X-Test": "yes" },
      }),
    );
    expect(wrapped.status).toBe(202);
    expect(wrapped.statusText).toBe("Accepted");
    expect(await wrapped.text()).toBe("body");
    expect(wrapped.headers.get("Access-Control-Allow-Origin")).toBe("https://example.com");
    for (const key of Object.keys(CORS_HEADERS)) expect(wrapped.headers.has(key)).toBe(true);
  });
});

describe("error capture", () => {
  afterEach(() => vi.useRealTimers());

  it("returns undefined when nothing was captured and consumes window errors once", () => {
    expect(consumeLastCapturedError()).toBeUndefined();
    const error = new Error("render failed");
    globalThis.dispatchEvent(new ErrorEvent("error", { error }));
    expect(consumeLastCapturedError()).toBe(error);
    expect(consumeLastCapturedError()).toBeUndefined();
  });

  it("captures error events without an Error and unhandled rejections", () => {
    const event = new Event("error");
    globalThis.dispatchEvent(event);
    expect(consumeLastCapturedError()).toBe(event);

    const rejection = new Event("unhandledrejection");
    Object.defineProperty(rejection, "reason", { value: "rejected" });
    globalThis.dispatchEvent(rejection);
    expect(consumeLastCapturedError()).toBe("rejected");
  });

  it("expires captured errors after five seconds", () => {
    vi.useFakeTimers();
    globalThis.dispatchEvent(new ErrorEvent("error", { error: "old" }));
    vi.advanceTimersByTime(5_001);
    expect(consumeLastCapturedError()).toBeUndefined();
  });

  it("skips attaching listeners when no global addEventListener exists", async () => {
    vi.resetModules();
    vi.stubGlobal("addEventListener", undefined);
    try {
      const { consumeLastCapturedError: freshConsume } = await import("../src/lib/error-capture");
      expect(freshConsume()).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
      vi.resetModules();
    }
  });
});

describe("fetch and promise helpers", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("passes request options and an abort signal to fetch", async () => {
    const response = new Response("ok");
    globalThis.fetch = vi.fn().mockResolvedValue(response);
    await expect(
      fetchWithTimeout(new URL("https://example.com"), { method: "POST" }, 50),
    ).resolves.toBe(response);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      new URL("https://example.com"),
      expect.objectContaining({ method: "POST", signal: expect.any(AbortSignal) }),
    );
  });

  it("aborts a fetch after the deadline and clears timers after rejection", async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const pending = fetchWithTimeout("https://example.com", undefined, 10);
    const rejection = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(10);
    await rejection;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("filters settled results and logs rejected arms", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(
      settledValues([
        { status: "fulfilled", value: 1 },
        { status: "rejected", reason: "nope" },
        { status: "fulfilled", value: 2 },
      ]),
    ).toEqual([1, 2]);
    expect(console.warn).toHaveBeenCalledWith("settled rejection:", "nope");
  });

  it("maps with bounded concurrency while preserving order, including an empty list", async () => {
    let active = 0;
    let maximum = 0;
    const result = await mapWithConcurrency([3, 1, 2], 2, async (value) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await Promise.resolve();
      active -= 1;
      return value * 2;
    });
    expect(result).toEqual([6, 2, 4]);
    expect(maximum).toBe(2);
    await expect(mapWithConcurrency([], 3, async (value) => value)).resolves.toEqual([]);
  });

  it("resolves deadlines from success, rejection, and timeout", async () => {
    await expect(withDeadline(Promise.resolve("ok"), 20, "fallback")).resolves.toBe("ok");
    await expect(withDeadline(Promise.reject(new Error("no")), 20, "fallback")).resolves.toBe(
      "fallback",
    );

    vi.useFakeTimers();
    const pending = withDeadline(new Promise<string>(() => undefined), 10, "fallback");
    await vi.advanceTimersByTimeAsync(10);
    await expect(pending).resolves.toBe("fallback");
  });
});

describe("SEO and JSON-LD helpers", () => {
  it("escapes JSON-LD and renders its script element", () => {
    expect(serializeJsonLd({ value: "</script>" })).toContain("\\u003c/script>");
    render(<JsonLd data={{ name: "OpenOdia" }} />);
    expect(document.querySelector('script[type="application/ld+json"]')?.textContent).toContain(
      "OpenOdia",
    );
  });

  it("builds every static schema and collection schema", () => {
    expect(siteOrganization()).toMatchObject({ "@type": "Organization" });
    expect(authorPerson()).toMatchObject({ "@type": "Person" });
    expect(webSiteSchema()).toMatchObject({ "@type": "WebSite" });
    expect(breadcrumbSchema([{ name: "Home", url: SITE }]).itemListElement[0]?.position).toBe(1);
    expect(faqPageSchema([{ question: "Why?", answer: "Because." }]).mainEntity[0]).toMatchObject({
      name: "Why?",
    });
    expect(
      itemListSchema(
        [{ name: "Tool", url: "https://example.com", description: "Useful" }],
        "Tools",
        "All tools",
      ),
    ).toMatchObject({ numberOfItems: 1 });
    expect(
      videoListSchema([
        {
          id: "abc",
          title: "Video",
          published: "2026-01-01",
          thumbnail: "thumb",
          channelName: "OpenOdia",
        },
      ]).itemListElement[0]?.item,
    ).toMatchObject({ contentUrl: "https://www.youtube.com/watch?v=abc" });
  });

  it("builds online and offline event schemas with optional fields", () => {
    const schema = eventListSchema([
      {
        name: "Offline",
        url: "https://example.com/offline",
        description: "Meet",
        startDate: "2026-01-01",
        endDate: "2026-01-02",
        location: "Bhubaneswar",
        organizer: "GDG",
      },
      {
        name: "Online",
        url: "https://example.com/online",
        description: "Meet online",
        startDate: "2026-02-01",
      },
    ]);
    expect(schema.numberOfItems).toBe(2);
    expect(schema.itemListElement[0]?.item).toMatchObject({
      endDate: "2026-01-02",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    });
    expect(schema.itemListElement[1]?.item).toMatchObject({
      eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    });
  });

  it("builds canonical URLs and default/overridden page metadata", () => {
    expect(canonicalUrl("")).toBe(SITE);
    expect(canonicalUrl("///events")).toBe(`${SITE}/events`);
    expect(pageHead({ path: "events", title: "Events", description: "List" })).toMatchObject({
      links: [{ rel: "canonical", href: `${SITE}/events` }],
    });
    const custom = pageHead({
      path: "events",
      title: "Events",
      description: "List",
      ogTitle: "Social title",
      ogDescription: "Social description",
      links: [{ rel: "alternate", href: "/feed", type: "rss", title: "Feed" }],
    });
    expect(custom.meta).toContainEqual({ property: "og:title", content: "Social title" });
    expect(custom.links).toHaveLength(2);
  });
});

describe("useIsMobile", () => {
  const originalMatchMedia = window.matchMedia;
  const originalInnerWidth = window.innerWidth;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: originalInnerWidth });
  });

  it("updates isMobile when the matchMedia listener fires a change event", () => {
    let onChange: (() => void) | undefined;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: (_event: string, listener: () => void) => {
        onChange = listener;
      },
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1200 });

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    Object.defineProperty(window, "innerWidth", { configurable: true, value: 400 });
    act(() => onChange?.());
    expect(result.current).toBe(true);
  });
});

describe("i18n scaffold", () => {
  afterEach(() => {
    localStorage.clear();
    captureI18nEffects = false;
    capturedI18nEffects = [];
    captureI18nState = false;
  });

  it("throws outside the provider", () => {
    expect(() => renderHook(() => useTranslation())).toThrow(
      "useTranslation must be used within an I18nProvider",
    );
  });

  it("loads a stored locale, falls back to English, and persists changes", () => {
    localStorage.setItem("locale", "or");
    const Consumer = () => {
      const { locale, setLocale, t } = useTranslation();
      return (
        <button onClick={() => setLocale("en")}>
          {locale}:{t("nav.events")}
        </button>
      );
    };
    render(
      <I18nProvider>
        <Consumer />
      </I18nProvider>,
    );
    expect(document.documentElement.lang).toBe("or");
    act(() => screen.getByRole("button").click());
    expect(localStorage.getItem("locale")).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });

  it("ignores invalid stored locales", () => {
    localStorage.setItem("locale", "invalid");
    const { result } = renderHook(() => useTranslation(), {
      wrapper: ({ children }) => <I18nProvider>{children}</I18nProvider>,
    });
    expect(result.current.locale).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });

  it("returns before touching localStorage when window is undefined (SSR)", () => {
    captureI18nEffects = true;
    const Consumer = () => {
      const { locale } = useTranslation();
      return <div>{locale}</div>;
    };
    render(
      <I18nProvider>
        <Consumer />
      </I18nProvider>,
    );
    captureI18nEffects = false;
    expect(capturedI18nEffects).toHaveLength(1);

    vi.stubGlobal("window", undefined);
    try {
      expect(() => capturedI18nEffects[0]?.()).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("falls back to the English string for a key missing from the Odia locale", () => {
    localStorage.setItem("locale", "or");
    const Consumer = () => {
      const { t } = useTranslation();
      return (
        <>
          <span data-testid="translated">{t("nav.home")}</span>
          <span data-testid="fallback">{t("nav.events")}</span>
        </>
      );
    };
    render(
      <I18nProvider>
        <Consumer />
      </I18nProvider>,
    );
    // "nav.home" is the one key our mocked `or` locale keeps — it takes the
    // non-fallback branch.
    expect(screen.getByTestId("translated")).toHaveTextContent("ମୂଳପୃଷ୍ଠା");
    // "nav.events" is absent from the mocked `or` locale — `??` falls
    // through to the English string.
    expect(screen.getByTestId("fallback")).toHaveTextContent("Events");
  });

  it("skips localStorage and documentElement when window is undefined during setLocale", () => {
    // Capture `setLocale`'s closure over a `setLocaleState` stand-in that
    // never touches React's dispatcher, so the state update line ahead of
    // the guard can run with `window` stubbed away without react-dom
    // crashing on `window.event` first.
    captureI18nState = true;
    const Consumer = () => {
      const { setLocale } = useTranslation();
      return (
        <button type="button" onClick={() => setLocale("or")}>
          switch
        </button>
      );
    };
    render(
      <I18nProvider>
        <Consumer />
      </I18nProvider>,
    );
    captureI18nState = false;
    document.documentElement.lang = "en";

    vi.stubGlobal("window", undefined);
    try {
      expect(() => screen.getByRole("button").click()).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
    expect(localStorage.getItem("locale")).toBeNull();
    expect(document.documentElement.lang).toBe("en");
  });
});
