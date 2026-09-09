import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const queryHarness = vi.hoisted(() => ({
  queries: [] as Array<{ queryFn: () => Promise<unknown> }>,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: { queryFn: () => Promise<unknown> }) => {
    queryHarness.queries.push(options);
    return { data: undefined, isLoading: false, isError: false };
  },
}));

// MagneticButton's pointer-move handler guards on two independent refs; the
// wrapping div's ref is always attached by the time an event can fire, but
// the inner span's ref is a second, genuinely-defensive check. To exercise
// that branch we intercept just the *second* `useRef` call made while the
// harness below is armed, so it reads back `.current` as null regardless of
// what React commits to it — every other `useRef` call (in this file or
// anywhere else) passes straight through to the real implementation.
const refHarness = vi.hoisted(() => ({ active: false, calls: 0 }));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useRef: (initial?: unknown) => {
      if (!refHarness.active) return actual.useRef(initial);
      refHarness.calls += 1;
      if (refHarness.calls === 2) {
        const ref = {};
        Object.defineProperty(ref, "current", { get: () => null, set: () => {} });
        return ref;
      }
      return actual.useRef(initial);
    },
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  queryHarness.queries.length = 0;
});

describe("CodeEditor scroll mirroring", () => {
  it("no-ops the horizontal scroll mirror when the <pre> ref is not attached", async () => {
    const { CodeEditor } = await import("../src/components/CodeEditor");
    // CodeEditor calls useRef twice — `taRef` first, `preRef` second — so
    // the shared refHarness (see the top of this file) intercepting "the
    // second useRef call" forces `preRef.current` to read back null exactly
    // as it does for MagneticButton's inner-span ref below.
    refHarness.active = true;
    refHarness.calls = 0;
    const onChange = vi.fn();
    const { container } = render(<CodeEditor value={"print(1)"} onChange={onChange} rows={2} />);
    refHarness.active = false;

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    const pre = container.querySelector("pre") as HTMLPreElement;
    Object.defineProperty(textarea, "scrollLeft", { value: 30, configurable: true });
    expect(() => fireEvent.scroll(textarea)).not.toThrow();
    // With preRef.current null the guard skips the mirror entirely.
    expect(pre.scrollLeft).toBe(0);
  });
});

describe("CodeEditor selection scheduling", () => {
  it("applies the deferred selection once the animation frame fires", async () => {
    const { CodeEditor } = await import("../src/components/CodeEditor");

    function ControlledEditor() {
      const [value, setValue] = useState("abc");
      return <CodeEditor value={value} onChange={setValue} rows={2} />;
    }

    render(<ControlledEditor />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    textarea.setSelectionRange(0, 0);
    fireEvent.keyDown(textarea, { key: "Tab" });
    expect(textarea.value).toBe("    abc");
    // setSelection schedules its write via requestAnimationFrame; let a real
    // frame elapse so `ta.selectionStart`/`selectionEnd` actually get set.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(textarea.selectionStart).toBe(4);
    expect(textarea.selectionEnd).toBe(4);
  });
});

describe("ContributorGrid data loader", () => {
  it("fetches contributors and rejects non-OK responses", async () => {
    const { ContributorGrid } = await import("../src/components/ContributorGrid");
    render(<ContributorGrid />);
    const { queryFn } = queryHarness.queries[0];

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
    await expect(queryFn()).resolves.toEqual({});

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 500 })));
    await expect(queryFn()).rejects.toThrow("fetch failed");
  });
});

describe("ContributorLeaderboard data loader", () => {
  it("fetches contributors and rejects non-OK responses", async () => {
    const { ContributorLeaderboard } = await import("../src/components/ContributorLeaderboard");
    render(<ContributorLeaderboard />);
    const { queryFn } = queryHarness.queries[0];

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
    await expect(queryFn()).resolves.toEqual({});

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 500 })));
    await expect(queryFn()).rejects.toThrow("fetch failed");
  });
});

describe("Transliterate race conditions and interactions", () => {
  it("discards a stale successful response superseded by a newer request", async () => {
    vi.useFakeTimers();
    let resolveFirst!: (value: string) => void;
    const runPythonAsync = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValue(JSON.stringify(["second-result", 0]));
    const py = { globals: { set: vi.fn() }, runPythonAsync };
    const ensureIndic = vi.fn().mockResolvedValue(undefined);
    const { Transliterate } = await import("../src/components/Transliterate");
    render(<Transliterate py={py} ensureIndic={ensureIndic} />);

    // Let the first debounced request fire and suspend on runPythonAsync.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    // Supersede it with a second request before the first resolves.
    fireEvent.change(screen.getByLabelText("Odia"), { target: { value: "second phrase" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(screen.getByText("second-result")).toBeInTheDocument();

    // The stale first request now resolves — it must be discarded.
    await act(async () => {
      resolveFirst(JSON.stringify(["stale-result", 0]));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("second-result")).toBeInTheDocument();
    expect(screen.queryByText("stale-result")).not.toBeInTheDocument();
  });

  it("discards a stale error from a superseded request", async () => {
    vi.useFakeTimers();
    let rejectFirst!: (reason: unknown) => void;
    const runPythonAsync = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<string>((_resolve, reject) => {
            rejectFirst = reject;
          }),
      )
      .mockResolvedValue(JSON.stringify(["second-result", 0]));
    const py = { globals: { set: vi.fn() }, runPythonAsync };
    const ensureIndic = vi.fn().mockResolvedValue(undefined);
    const { Transliterate } = await import("../src/components/Transliterate");
    render(<Transliterate py={py} ensureIndic={ensureIndic} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    fireEvent.change(screen.getByLabelText("Odia"), { target: { value: "second phrase" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(screen.getByText("second-result")).toBeInTheDocument();

    await act(async () => {
      rejectFirst(new Error("stale failure"));
      await Promise.resolve();
      await Promise.resolve();
    });
    // The stale rejection must not surface as an error, and the newer,
    // successful result must remain on screen.
    expect(screen.queryByText("stale failure")).not.toBeInTheDocument();
    expect(screen.getByText("second-result")).toBeInTheDocument();
  });

  it("fills the source field from a sample phrase and copies the result", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const py = {
      globals: { set: vi.fn() },
      runPythonAsync: vi.fn().mockResolvedValue(JSON.stringify(["converted", 0])),
    };
    const ensureIndic = vi.fn().mockResolvedValue(undefined);
    const { Transliterate } = await import("../src/components/Transliterate");
    const PHRASES = [
      "ଓଡ଼ିଶାର ରାଜଧାନୀ ଭୁବନେଶ୍ୱର",
      "ମୋ ଭାଷା ମୋ ଗର୍ବ",
      "ଜଗନ୍ନାଥ ମନ୍ଦିର ପୁରୀରେ ଅଛି",
      "ଆମ ଭାଷା, ଆମ ପରିଚୟ ।",
    ];
    render(<Transliterate py={py} ensureIndic={ensureIndic} />);

    const secondPhrase = screen.getByRole("button", { name: PHRASES[1] });
    await act(async () => {
      fireEvent.click(secondPhrase);
    });
    expect(screen.getByLabelText("Odia")).toHaveValue(PHRASES[1]);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
    });
    expect(await screen.findByText("converted")).toBeInTheDocument();

    const copyButton = screen.getByRole("button", { name: /Copy .* text/ });
    await act(async () => {
      fireEvent.click(copyButton);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledWith("converted");
  });

  it("resets the copied checkmark back to the clipboard icon after the timeout", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const py = {
      globals: { set: vi.fn() },
      runPythonAsync: vi.fn().mockResolvedValue(JSON.stringify(["converted", 0])),
    };
    const ensureIndic = vi.fn().mockResolvedValue(undefined);
    const { Transliterate } = await import("../src/components/Transliterate");
    const { container } = render(<Transliterate py={py} ensureIndic={ensureIndic} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    const copyButton = screen.getByRole("button", { name: /Copy .* text/ });
    await act(async () => {
      fireEvent.click(copyButton);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector(".lucide-check")).toBeInTheDocument();

    // The 2s reset timer flips the icon back to the clipboard glyph.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(container.querySelector(".lucide-check")).not.toBeInTheDocument();
    expect(container.querySelector(".lucide-clipboard")).toBeInTheDocument();
  });

  it("shows the Error instance's message when transliteration rejects with a real Error", async () => {
    vi.useFakeTimers();
    const py = {
      globals: { set: vi.fn() },
      runPythonAsync: vi.fn().mockRejectedValue(new Error("boom")),
    };
    const ensureIndic = vi.fn().mockResolvedValue(undefined);
    const { Transliterate } = await import("../src/components/Transliterate");
    render(<Transliterate py={py} ensureIndic={ensureIndic} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("uses singular gap wording when exactly one character has no equivalent", async () => {
    vi.useFakeTimers();
    const py = {
      globals: { set: vi.fn() },
      runPythonAsync: vi.fn().mockResolvedValue(JSON.stringify(["converted", 1])),
    };
    const ensureIndic = vi.fn().mockResolvedValue(undefined);
    const { Transliterate } = await import("../src/components/Transliterate");
    render(<Transliterate py={py} ensureIndic={ensureIndic} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(screen.getByText(/One character has/)).toBeInTheDocument();
    expect(screen.getByText(/it shows as a box/)).toBeInTheDocument();
  });
});

describe("MagneticButton defensive ref guard", () => {
  it("no-ops a pointer move when the inner span ref is not attached", async () => {
    const { MagneticButton } = await import("../src/components/MagneticButton");
    refHarness.active = true;
    refHarness.calls = 0;
    const { container } = render(<MagneticButton onClick={vi.fn()}>Move</MagneticButton>);
    refHarness.active = false;

    const wrapper = container.firstChild as HTMLElement;
    expect(() => fireEvent.mouseMove(wrapper, { clientX: 10, clientY: 10 })).not.toThrow();
  });
});
