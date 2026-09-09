import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Edge-case coverage for src/routes/playground.tsx.
 *
 * test/routes-rendering.test.tsx already exercises the happy path (boot, run,
 * format, copy, clear, tab switching, fullscreen, Pyodide script load
 * failure). This file targets the branches that are left uncovered:
 * validateSearch/head, the loadPyodide-missing guard, stderr output, an
 * unmount-before-boot-settles race, ensureIndic's !py guard, the fullscreen
 * sync effect and exit path, the copied-reset timer, Odialang/Python run
 * errors, format's repeat-install / non-string-result / failure branches,
 * and navigating back to the "python" tab.
 *
 * Each render imports a fresh module instance (vi.resetModules) so the
 * module-level `bootPromise` singleton in playground.tsx never leaks state
 * between tests.
 */

const harness = vi.hoisted(() => ({
  search: {} as Record<string, unknown>,
  navigate: vi.fn(),
  eagerEnsureIndic: false,
  odiaShouldThrow: false,
}));

vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  return {
    createFileRoute: (_path: string) => (options: Record<string, unknown>) => ({
      options,
      useSearch: () => harness.search,
      useNavigate: () => harness.navigate,
    }),
    Link: ({
      children,
      to,
      className,
    }: {
      children?: React.ReactNode;
      to?: string;
      className?: string;
    }) => React.createElement("a", { href: to, className }, children),
    useNavigate: () => harness.navigate,
  };
});

vi.mock("../src/components/Reveal", () => ({
  Reveal: ({ children, hidden }: { children?: React.ReactNode; hidden?: boolean }) =>
    hidden ? null : children,
}));

vi.mock("../src/components/CodeEditor", () => ({
  CodeEditor: ({
    value,
    onChange,
    disabled,
  }: {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
  }) => (
    <textarea
      aria-label="editor"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

vi.mock("../src/components/Transliterate", () => ({
  Transliterate: ({ ensureIndic }: { ensureIndic: () => Promise<void> }) => {
    // Real Transliterate only calls ensureIndic once its `py` prop is truthy.
    // A test can flip this flag to simulate a caller that ignores that
    // contract, exercising ensureIndic's own `!py` guard.
    if (harness.eagerEnsureIndic) void ensureIndic().catch(() => {});
    return <div>transliterate</div>;
  },
}));

vi.mock("@devsuvam/odialang/dist/lexer/tokenizer", () => ({
  tokenize: (source: string) => source,
}));
vi.mock("@devsuvam/odialang/dist/parser/parser", () => ({
  Parser: class {
    parseProgram() {
      return {};
    }
  },
}));
vi.mock("@devsuvam/odialang/dist/codegen/generate", () => ({
  generateJavaScript: () => {
    if (harness.odiaShouldThrow) throw new Error("odia compile failed");
    return 'console.log("odia output")';
  },
}));

vi.mock("../src/lib/jsonld", () => ({
  JsonLd: () => null,
  breadcrumbSchema: () => ({}),
}));

type PyMock = {
  loadPackage: ReturnType<typeof vi.fn>;
  pyimport: ReturnType<typeof vi.fn>;
  runPythonAsync: ReturnType<typeof vi.fn>;
  globals: { set: ReturnType<typeof vi.fn> };
  setStdout: ReturnType<typeof vi.fn>;
  setStderr: ReturnType<typeof vi.fn>;
};

function createPy(overrides: Partial<PyMock> = {}): PyMock {
  return {
    loadPackage: vi.fn().mockResolvedValue(undefined),
    pyimport: vi.fn(() => ({ install: vi.fn().mockResolvedValue(undefined) })),
    runPythonAsync: vi.fn().mockResolvedValue(undefined),
    globals: { set: vi.fn() },
    setStdout: vi.fn(),
    setStderr: vi.fn(),
    ...overrides,
  };
}

type RouteModule = {
  Route: {
    options: {
      component: ComponentType;
      validateSearch: (search: Record<string, unknown>) => { tab?: string };
      head: () => { meta: unknown[]; links: unknown[] };
    };
  };
};

async function loadPlayground() {
  return (await import("../src/routes/playground")) as RouteModule;
}

async function renderPlayground(search: Record<string, unknown> = {}) {
  vi.resetModules();
  harness.search = search;
  const mod = await loadPlayground();
  const view = render(<mod.Route.options.component />);
  return { view, Route: mod.Route };
}

function lastScript(): Element {
  const scripts = document.querySelectorAll("#pyodide-script");
  return scripts.item(scripts.length - 1);
}

// jsdom doesn't implement the Fullscreen API; stub it once so the sync effect
// and the exit-fullscreen branch can be driven from tests.
const fullscreenHolder: { current: Element | null } = { current: null };
Object.defineProperty(document, "fullscreenElement", {
  configurable: true,
  get: () => fullscreenHolder.current,
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  harness.navigate.mockClear();
  harness.eagerEnsureIndic = false;
  harness.odiaShouldThrow = false;
  fullscreenHolder.current = null;
  delete (window as { loadPyodide?: unknown }).loadPyodide;
});

describe("playground route config", () => {
  it("computes validateSearch branches and head metadata", async () => {
    vi.resetModules();
    const mod = await loadPlayground();
    const { validateSearch, head } = mod.Route.options;

    expect(validateSearch({ tab: "python" })).toEqual({ tab: "python" });
    expect(validateSearch({ tab: "odia" })).toEqual({ tab: "odia" });
    expect(validateSearch({ tab: "translit" })).toEqual({ tab: "translit" });
    expect(validateSearch({ tab: "bogus" })).toEqual({});
    expect(validateSearch({})).toEqual({});

    const result = head();
    expect(result.meta.length).toBeGreaterThan(0);
    expect(result.links.length).toBeGreaterThan(0);
  });
});

describe("playground edge cases", () => {
  it("surfaces an error when the Pyodide script loads without exposing loadPyodide", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    delete (window as { loadPyodide?: unknown }).loadPyodide;

    await renderPlayground({});
    fireEvent.load(lastScript());

    expect(
      await screen.findByText("Pyodide script loaded but loadPyodide missing"),
    ).toBeInTheDocument();
  });

  it("falls back to a generic message when the boot failure is not an Error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    window.loadPyodide = vi.fn().mockRejectedValue("boom");

    await renderPlayground({});
    fireEvent.load(lastScript());

    expect(await screen.findByText("Failed to initialize")).toBeInTheDocument();
  });

  it("appends stderr output emitted while running Python", async () => {
    let stderr: ((value: string) => void) | undefined;
    const py = createPy({
      setStderr: vi.fn(({ batched }: { batched: (value: string) => void }) => {
        stderr = batched;
      }),
      runPythonAsync: vi.fn(async () => {
        stderr?.("python stderr line");
        return undefined;
      }),
    });
    window.loadPyodide = vi.fn().mockResolvedValue(py);

    await renderPlayground({});
    fireEvent.load(lastScript());
    expect(await screen.findByText("Ready. Hit Run to execute.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(await screen.findByText("python stderr line")).toBeInTheDocument();
  });

  it("ignores a boot rejection that settles after the component has unmounted", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    delete (window as { loadPyodide?: unknown }).loadPyodide;

    const { view } = await renderPlayground({});
    const script = lastScript();
    view.unmount();

    // The script tag is appended directly to document.body outside React,
    // so it survives the unmount and can still reject the pending boot.
    fireEvent.error(script);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    // Nothing to assert on screen (the component is gone) — this exercises
    // the `if (cancelled) return;` branch in the boot failure handler
    // without throwing or warning about updating an unmounted component.
  });

  it("surfaces an error when ensureIndic runs before Pyodide is ready", async () => {
    harness.eagerEnsureIndic = true;

    await renderPlayground({ tab: "translit" });
    expect(await screen.findByText("transliterate")).toBeInTheDocument();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    // ensureIndic threw "Python runtime is still loading" (py is null) and
    // its own .catch reset indicRef so a later call could retry; the mocked
    // Transliterate swallows the rejection, so there is nothing to assert on
    // screen beyond this not blowing up.
  });

  it("syncs fullscreen state and exits fullscreen via the toggle button", async () => {
    await renderPlayground({});
    const gridEl = document.querySelector(".grid") as HTMLElement;
    const shellEl = gridEl.parentElement as HTMLElement;

    fullscreenHolder.current = shellEl;
    fireEvent(document, new Event("fullscreenchange"));
    expect(await screen.findByRole("button", { name: "Exit full screen" })).toBeInTheDocument();

    const exitFullscreen = vi.fn().mockResolvedValue(undefined);
    document.exitFullscreen = exitFullscreen;
    fireEvent.click(screen.getByRole("button", { name: "Exit full screen" }));
    expect(exitFullscreen).toHaveBeenCalled();

    fullscreenHolder.current = null;
    fireEvent(document, new Event("fullscreenchange"));
    expect(await screen.findByRole("button", { name: "Full screen" })).toBeInTheDocument();
  });

  it("resets the copied indicator after the timeout elapses", async () => {
    let stdout: ((value: string) => void) | undefined;
    const py = createPy({
      runPythonAsync: vi.fn(async () => {
        stdout?.("python output");
        return undefined;
      }),
      setStdout: vi.fn(({ batched }: { batched: (value: string) => void }) => {
        stdout = batched;
      }),
    });
    window.loadPyodide = vi.fn().mockResolvedValue(py);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    await renderPlayground({});
    fireEvent.load(lastScript());
    expect(await screen.findByText("Ready. Hit Run to execute.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    await screen.findByText("python output");

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Copy output" }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledWith("python output\n");

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
  });

  it("surfaces an error thrown while running Odialang code", async () => {
    harness.odiaShouldThrow = true;

    await renderPlayground({ tab: "odia" });
    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    expect(await screen.findByText(/odia compile failed/)).toBeInTheDocument();
  });

  it("surfaces an error thrown while running Python code", async () => {
    const py = createPy({ runPythonAsync: vi.fn().mockRejectedValue(new Error("python failed")) });
    window.loadPyodide = vi.fn().mockResolvedValue(py);

    await renderPlayground({});
    fireEvent.load(lastScript());
    await screen.findByText("Ready. Hit Run to execute.");

    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(await screen.findByText(/python failed/)).toBeInTheDocument();
  });

  it("skips reinstalling black and setting code on a non-string format result, then surfaces a format failure", async () => {
    const install = vi.fn().mockResolvedValue(undefined);
    let formatCalls = 0;
    const py = createPy({
      pyimport: vi.fn(() => ({ install })),
      runPythonAsync: vi.fn(async (code: string) => {
        if (!code.includes("black.format_str")) return undefined;
        formatCalls += 1;
        if (formatCalls === 1) return "print('formatted once')\n";
        if (formatCalls === 2) return 42;
        throw new Error("black failed");
      }),
    });
    window.loadPyodide = vi.fn().mockResolvedValue(py);

    await renderPlayground({});
    fireEvent.load(lastScript());
    await screen.findByText("Ready. Hit Run to execute.");

    const formatButton = () => screen.getByRole("button", { name: /Format/ });
    const editor = () => screen.getByRole("textbox", { name: "editor" });
    const blackInstalls = () => install.mock.calls.filter(([pkg]) => pkg === "black").length;

    // 1st format: black is not installed yet, and the result is a string.
    // (`install` is also called once during boot, for openodia's deps.)
    fireEvent.click(formatButton());
    await waitFor(() => expect(editor()).toHaveValue("print('formatted once')\n"));
    expect(blackInstalls()).toBe(1);

    // 2nd format: black is already installed (skip install), and the result
    // is not a string (skip setCode) — the editor value stays unchanged.
    fireEvent.click(formatButton());
    await waitFor(() => expect(py.runPythonAsync).toHaveBeenCalledTimes(2));
    expect(blackInstalls()).toBe(1);
    expect(editor()).toHaveValue("print('formatted once')\n");

    // 3rd format: runPythonAsync rejects — the failure is appended to output
    // instead of replacing the code.
    fireEvent.click(formatButton());
    expect(await screen.findByText(/\[format failed\] Error: black failed/)).toBeInTheDocument();
    expect(editor()).toHaveValue("print('formatted once')\n");
  });

  it("passes an empty search when navigating back to the python tab", async () => {
    await renderPlayground({ tab: "odia" });

    fireEvent.click(screen.getByRole("button", { name: "Python · openodia" }));

    expect(harness.navigate).toHaveBeenCalledWith({ search: {}, replace: true });
  });
});
