import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const componentHarness = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
  setLocale: vi.fn(),
  locale: "en" as "en" | "or",
}));

// `Nav`'s SSR guards (`typeof window !== "undefined"`) can only be observed
// by running its internals outside React's own scheduler: react-dom
// unconditionally reads `window.event` while flushing passive effects *and*
// while processing a state update, so deleting the global `window` before a
// real render/update crashes React itself before either guard is ever
// reached. Capturing the raw mount-effect callback (and standing in for the
// `theme` state setter with a plain closure assignment) sidesteps that
// scheduler entirely; every other render in this file falls through
// untouched to the real `useEffect`/`useState`. Mirrors the same technique
// used for `I18nProvider` in test/shared-lib-coverage.test.tsx.
const navSsrHarness = vi.hoisted(() => ({
  captureNavEffects: false,
  captureNavThemeState: false,
  capturedNavEffects: [] as Array<() => void>,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useEffect: (fn: () => void, deps?: unknown[]) => {
      if (navSsrHarness.captureNavEffects) {
        navSsrHarness.capturedNavEffects.push(fn);
        return;
      }
      return actual.useEffect(fn, deps);
    },
    useState: <T,>(init: T) => {
      if (navSsrHarness.captureNavThemeState && init === "dark") {
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

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => componentHarness.query,
}));

vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  return {
    Link: ({
      children,
      to,
      className,
      onClick,
    }: {
      children?: ReactNode;
      to?: string;
      className?: string;
      onClick?: () => void;
    }) =>
      React.createElement(
        "a",
        {
          href: to,
          className,
          onClick: (event: { preventDefault: () => void }) => {
            event.preventDefault();
            onClick?.();
          },
        },
        children,
      ),
    useRouterState: () => ({ location: { pathname: "/tools" } }),
  };
});

vi.mock("../src/lib/i18n", () => ({
  useTranslation: () => ({
    locale: componentHarness.locale,
    setLocale: componentHarness.setLocale,
    t: (key: string) => key,
  }),
}));

vi.mock("../src/components/Reveal", () => ({
  Reveal: ({ children }: { children?: ReactNode }) => children,
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  componentHarness.query = {};
  componentHarness.setLocale.mockClear();
  componentHarness.locale = "en";
  document.documentElement.classList.remove("light");
  navSsrHarness.captureNavEffects = false;
  navSsrHarness.captureNavThemeState = false;
  navSsrHarness.capturedNavEffects = [];
});

describe("shared presentational components", () => {
  it("renders FAQ, footer, marquee, and featured cards", async () => {
    const { FaqSection, FAQS } = await import("../src/components/FaqSection");
    const { Footer } = await import("../src/components/Footer");
    const { Marquee } = await import("../src/components/Marquee");
    const { FeaturedGallery, formatCount } = await import("../src/components/FeaturedGallery");

    expect(formatCount(2_000_000)).toBe("2.0M");
    expect(formatCount(2_000)).toBe("2.0k");
    expect(formatCount(20)).toBe("20");

    render(
      <>
        <FaqSection />
        <Footer />
        <Marquee items={["Odia"]} />
        <FeaturedGallery
          hero={[
            {
              id: "hero",
              name: "Hero",
              author: "OpenOdia",
              url: "https://example.com/hero",
              label: "Translation",
              description: "Featured model",
              downloads: 2_000,
              likes: 20,
            },
          ]}
          reels={[
            {
              id: "reel",
              name: "Reel",
              author: "OpenOdia",
              url: "https://example.com/reel",
              label: "ASR",
              downloads: 12,
              likes: 3,
            },
          ]}
        />
      </>,
    );

    expect(screen.getByText(FAQS[0].q)).toBeInTheDocument();
    expect(screen.getAllByText("Odia").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Hero")).toBeInTheDocument();
    cleanup();
    const { container } = render(<FeaturedGallery hero={[]} reels={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("covers magnetic button links, clicks, movement, and reset", async () => {
    const { MagneticButton } = await import("../src/components/MagneticButton");
    const clicked = vi.fn();
    const { rerender } = render(
      <MagneticButton href="https://example.com" external onClick={clicked}>
        Open
      </MagneticButton>,
    );
    const wrapper = screen.getByText("Open").parentElement?.parentElement as HTMLElement;
    vi.spyOn(wrapper, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 100,
      height: 40,
      right: 100,
      bottom: 40,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    fireEvent.mouseMove(wrapper, { clientX: 75, clientY: 30 });
    expect(screen.getByText("Open")).toHaveStyle({ transform: "translate3d(6.25px, 2.5px, 0)" });
    fireEvent.mouseLeave(wrapper);
    rerender(<MagneticButton href="https://example.com">No external</MagneticButton>);
    const plainLink = screen.getByText("No external").closest("a");
    expect(plainLink).not.toHaveAttribute("target");
    expect(plainLink).not.toHaveAttribute("rel");
    rerender(<MagneticButton onClick={clicked}>Click</MagneticButton>);
    fireEvent.click(screen.getByRole("button", { name: "Click" }));
    expect(clicked).toHaveBeenCalled();
    rerender(<MagneticButton variant="ghost">Inside link</MagneticButton>);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows scroll-to-top only after scrolling", async () => {
    const scrollTo = vi.fn();
    Object.defineProperty(window, "scrollY", { value: 0, writable: true, configurable: true });
    Object.defineProperty(window, "scrollTo", { value: scrollTo, configurable: true });
    const { ScrollToTop } = await import("../src/components/ScrollToTop");
    render(<ScrollToTop />);
    expect(screen.queryByRole("button", { name: "Scroll to top" })).not.toBeInTheDocument();
    window.scrollY = 500;
    fireEvent.scroll(window);
    fireEvent.click(screen.getByRole("button", { name: "Scroll to top" }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("opens navigation and dispatches theme, locale, and search actions", async () => {
    const palette = vi.fn();
    window.addEventListener("openCommandPalette", palette);
    const { Nav } = await import("../src/components/Nav");
    render(<Nav />);
    fireEvent.click(screen.getByRole("button", { name: "nav.search.aria" }));
    expect(palette).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "nav.locale.aria" }));
    expect(componentHarness.setLocale).toHaveBeenCalledWith("or");
    const theme = screen.getByRole("button", { name: "nav.theme.aria" });
    fireEvent.click(theme);
    expect(document.documentElement).toHaveClass("light");
    fireEvent.click(theme);
    expect(document.documentElement).not.toHaveClass("light");
    const menu = screen.getByRole("button", { name: "nav.menu.aria" });
    fireEvent.click(menu);
    expect(screen.getAllByText("nav.contribute").length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByText("nav.contribute")[0]);
    window.removeEventListener("openCommandPalette", palette);
  });

  it("seeds theme state from an existing light class on mount", async () => {
    document.documentElement.classList.add("light");
    const { Nav } = await import("../src/components/Nav");
    render(<Nav />);
    const theme = screen.getByRole("button", { name: "nav.theme.aria" });
    fireEvent.click(theme);
    expect(document.documentElement).not.toHaveClass("light");
  });

  it("renders the Odia-locale sides of the locale toggle", async () => {
    componentHarness.locale = "or";
    const { Nav } = await import("../src/components/Nav");
    render(<Nav />);
    const localeButton = screen.getByRole("button", { name: "nav.locale.aria" });
    const label = screen.getByText("English");
    expect(label).toHaveAttribute("lang", "en");
    fireEvent.click(localeButton);
    expect(componentHarness.setLocale).toHaveBeenCalledWith("en");
  });

  it("skips seeding theme from document.documentElement when window is undefined (SSR)", async () => {
    navSsrHarness.captureNavEffects = true;
    const { Nav } = await import("../src/components/Nav");
    render(<Nav />);
    navSsrHarness.captureNavEffects = false;
    expect(navSsrHarness.capturedNavEffects).toHaveLength(1);

    vi.stubGlobal("window", undefined);
    try {
      expect(() => navSsrHarness.capturedNavEffects[0]?.()).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("skips localStorage and documentElement when window is undefined during toggleTheme", async () => {
    // Capture `theme`'s state with a stand-in setter that never touches
    // React's dispatcher, so the state update ahead of the guard can run
    // with `window` stubbed away without react-dom crashing on
    // `window.event` first (see navSsrHarness comment above).
    navSsrHarness.captureNavThemeState = true;
    const { Nav } = await import("../src/components/Nav");
    render(<Nav />);
    navSsrHarness.captureNavThemeState = false;
    const theme = screen.getByRole("button", { name: "nav.theme.aria" });

    vi.stubGlobal("window", undefined);
    try {
      expect(() => theme.click()).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
    expect(document.documentElement).not.toHaveClass("light");
  });
});

describe("code editor behavior", () => {
  it("handles change, scrolling, tab, shift-tab, and indented enter", async () => {
    const { CodeEditor } = await import("../src/components/CodeEditor");
    const onChange = vi.fn();
    const { rerender, container } = render(
      <CodeEditor value={"if ready:\n    run()"} onChange={onChange} rows={2} language="python" />,
    );
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "changed" } });
    expect(onChange).toHaveBeenCalledWith("changed");

    const pre = container.querySelector("pre") as HTMLPreElement;
    Object.defineProperty(textarea, "scrollLeft", { value: 20, configurable: true });
    fireEvent.scroll(textarea);
    expect(pre.scrollLeft).toBe(20);

    textarea.setSelectionRange(0, 0);
    fireEvent.keyDown(textarea, { key: "Tab" });
    expect(onChange).toHaveBeenLastCalledWith("    if ready:\n    run()");

    textarea.setSelectionRange(0, textarea.value.length);
    fireEvent.keyDown(textarea, { key: "Tab" });
    expect(onChange).toHaveBeenLastCalledWith("    if ready:\n        run()");

    rerender(<CodeEditor value={"    one\n\ttwo"} onChange={onChange} language="odialang" />);
    const dedent = screen.getByRole("textbox") as HTMLTextAreaElement;
    dedent.setSelectionRange(0, dedent.value.length);
    fireEvent.keyDown(dedent, { key: "Tab", shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith("one\ntwo");

    rerender(<CodeEditor value={"    if ready:"} onChange={onChange} />);
    const enter = screen.getByRole("textbox") as HTMLTextAreaElement;
    enter.setSelectionRange(enter.value.length, enter.value.length);
    fireEvent.keyDown(enter, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith("    if ready:\n        ");

    rerender(<CodeEditor value={"plain"} onChange={onChange} />);
    const unchanged = screen.getByRole("textbox") as HTMLTextAreaElement;
    unchanged.setSelectionRange(0, unchanged.value.length);
    fireEvent.keyDown(unchanged, { key: "Tab", shiftKey: true });
  });

  it("keeps the line range within a following line when a selection doesn't reach the end", async () => {
    const { CodeEditor } = await import("../src/components/CodeEditor");
    const onChange = vi.fn();
    render(<CodeEditor value={"if ready:\n    run()\nmore"} onChange={onChange} rows={3} />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    // Select across the first two lines only — `getLineRange`'s `lineEnd`
    // then resolves to the real index of the following "\n" rather than
    // falling back to `text.length`.
    textarea.setSelectionRange(0, 14);
    fireEvent.keyDown(textarea, { key: "Tab" });
    expect(onChange).toHaveBeenLastCalledWith("    if ready:\n        run()\nmore");
  });

  it("dedents a block whose first line has no leading whitespace to remove", async () => {
    const { CodeEditor } = await import("../src/components/CodeEditor");
    const onChange = vi.fn();
    render(<CodeEditor value={"run()\n    inner()"} onChange={onChange} rows={2} />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    textarea.setSelectionRange(0, textarea.value.length);
    fireEvent.keyDown(textarea, { key: "Tab", shiftKey: true });
    // Only the second line had leading whitespace to strip; the first line
    // (with none) leaves `firstLineMatch` null.
    expect(onChange).toHaveBeenLastCalledWith("run()\ninner()");
  });

  it("ignores keys that are neither Tab nor Enter", async () => {
    const { CodeEditor } = await import("../src/components/CodeEditor");
    const onChange = vi.fn();
    render(<CodeEditor value={"abc"} onChange={onChange} rows={2} />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    textarea.setSelectionRange(1, 1);
    fireEvent.keyDown(textarea, { key: "a" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not add extra indent on Enter when the previous line has no trailing colon", async () => {
    const { CodeEditor } = await import("../src/components/CodeEditor");
    const onChange = vi.fn();
    render(<CodeEditor value={"    run()"} onChange={onChange} rows={2} />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    fireEvent.keyDown(textarea, { key: "Enter" });
    // The new line keeps the same indent as "    run()" — no extra level,
    // since the line doesn't end in ":".
    expect(onChange).toHaveBeenLastCalledWith("    run()\n    ");
  });
});

describe("transliteration behavior", () => {
  it("debounces conversion, changes options, clears input, and copies output", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const py = {
      globals: { set: vi.fn() },
      runPythonAsync: vi.fn().mockResolvedValue(JSON.stringify(["देवनागरी", 2])),
    };
    const ensureIndic = vi.fn().mockResolvedValue(undefined);
    const { Transliterate } = await import("../src/components/Transliterate");
    render(<Transliterate py={py} ensureIndic={ensureIndic} />);
    await act(async () => vi.advanceTimersByTimeAsync(200));
    expect(screen.getByText("देवनागरी")).toBeInTheDocument();
    expect(screen.getByText(/2 characters have/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy Devanagari text" }));
    await act(async () => Promise.resolve());
    expect(writeText).toHaveBeenCalledWith("देवनागरी");

    fireEvent.change(screen.getByLabelText("Convert to which script"), { target: { value: "gu" } });
    fireEvent.click(screen.getByRole("checkbox"));
    await act(async () => vi.advanceTimersByTimeAsync(200));
    expect(py.globals.set).toHaveBeenCalledWith("__target", "gu");

    fireEvent.change(screen.getByLabelText("Odia"), { target: { value: "   " } });
    expect(screen.getByText("Type Odia on the left.")).toBeInTheDocument();
  });

  it("shows warm-up and conversion errors", async () => {
    vi.useFakeTimers();
    const { Transliterate } = await import("../src/components/Transliterate");
    const { rerender } = render(<Transliterate py={null} ensureIndic={vi.fn()} />);
    expect(screen.getByText(/Warming up/)).toBeInTheDocument();
    const py = {
      globals: { set: vi.fn() },
      runPythonAsync: vi.fn().mockRejectedValue("conversion failed"),
    };
    rerender(<Transliterate py={py} ensureIndic={vi.fn().mockResolvedValue(undefined)} />);
    await act(async () => vi.advanceTimersByTimeAsync(200));
    expect(screen.getByText("conversion failed")).toBeInTheDocument();
  });
});

describe("contributor components", () => {
  const contributors = [
    {
      login: "v2-user",
      avatar_url: "v2.png",
      html_url: "https://github.com/v2-user",
      contributions: 10,
      repos: [
        {
          name: "repo",
          full_name: "org/repo",
          contributions: 1,
          stars: 2,
          html_url: "https://github.com/org/repo",
        },
      ],
    },
    {
      login: "v1-user",
      avatar_url: "v1.png",
      html_url: "https://github.com/v1-user",
      contributions: 4,
      repos: ["old/repo"],
    },
    {
      login: "empty-user",
      avatar_url: "empty.png",
      html_url: "https://github.com/empty-user",
      contributions: 1,
      repos: [],
    },
  ];

  it("renders loading, error, legacy, current, and expanded contributor cards", async () => {
    const { ContributorGrid } = await import("../src/components/ContributorGrid");
    componentHarness.query = { isLoading: true };
    const { rerender } = render(<ContributorGrid />);
    expect(document.querySelectorAll(".animate-pulse")).toHaveLength(8);
    componentHarness.query = { isLoading: false, isError: true };
    rerender(<ContributorGrid />);
    expect(screen.getByText(/being gathered/)).toBeInTheDocument();
    componentHarness.query = {
      isLoading: false,
      isError: false,
      data: { contributors, totalContributors: 3 },
    };
    rerender(<ContributorGrid />);
    fireEvent.click(screen.getByRole("button", { name: /v2-user/ }));
    expect(screen.getByText("org/repo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /v1-user/ }));
    expect(screen.getByText("old/repo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /empty-user/ }));
    expect(screen.getByText("No Odia repos tracked.")).toBeInTheDocument();
  });

  it("collapses an expanded contributor in the grid when clicked again", async () => {
    const { ContributorGrid } = await import("../src/components/ContributorGrid");
    componentHarness.query = {
      isLoading: false,
      isError: false,
      data: { contributors, totalContributors: 3 },
    };
    render(<ContributorGrid />);
    fireEvent.click(screen.getByRole("button", { name: /v2-user/ }));
    expect(screen.getByText("org/repo")).toBeInTheDocument();
    // Clicking the same, currently-expanded contributor again is the
    // `prev === login` branch of the toggle — it collapses back to nothing.
    fireEvent.click(screen.getByRole("button", { name: /v2-user/ }));
    expect(screen.queryByText("org/repo")).not.toBeInTheDocument();
  });

  it("pluralizes a repo's commit count when it is not exactly one", async () => {
    const { ContributorGrid } = await import("../src/components/ContributorGrid");
    componentHarness.query = {
      isLoading: false,
      isError: false,
      data: {
        contributors: [
          {
            login: "multi-user",
            avatar_url: "multi.png",
            html_url: "https://github.com/multi-user",
            contributions: 5,
            repos: [
              {
                name: "repo",
                full_name: "org/multi",
                contributions: 5,
                stars: 1,
                html_url: "https://github.com/org/multi",
              },
            ],
          },
        ],
        totalContributors: 1,
      },
    };
    render(<ContributorGrid />);
    fireEvent.click(screen.getByRole("button", { name: /multi-user/ }));
    expect(screen.getByText("5 commits")).toBeInTheDocument();
  });

  it("renders and expands each leaderboard rank and repository shape", async () => {
    const { ContributorLeaderboard } = await import("../src/components/ContributorLeaderboard");
    componentHarness.query = { data: { contributors: [], totalContributors: 0 } };
    const { rerender, container } = render(<ContributorLeaderboard />);
    expect(container).toBeEmptyDOMElement();
    componentHarness.query = {
      data: {
        contributors: [
          ...contributors,
          { ...contributors[0], login: "fourth", contributions: 0, repos: [] },
        ],
        totalContributors: 4,
      },
    };
    rerender(<ContributorLeaderboard limit={4} />);
    for (const login of ["v2-user", "v1-user", "empty-user", "fourth"]) {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(login) }));
    }
    expect(screen.getByText("No Odia repos tracked.")).toBeInTheDocument();
    expect(screen.getByText("View GitHub profile")).toBeInTheDocument();

    // Clicking the currently-expanded contributor ("fourth", the last one
    // clicked above) again collapses it — the `prev === login` branch of the
    // toggle — leaving no row expanded.
    fireEvent.click(screen.getByRole("button", { name: /fourth/ }));
    expect(screen.queryByText("View GitHub profile")).not.toBeInTheDocument();
  });
});
