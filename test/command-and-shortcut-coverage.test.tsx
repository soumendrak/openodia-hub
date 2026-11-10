import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSearchShortcut } from "../src/hooks/useSearchShortcut";

const harness = vi.hoisted(() => ({
  navigate: vi.fn(),
  query: undefined as string | undefined,
  loading: false,
  failure: false,
  refetch: vi.fn(),
  resultOverride: undefined as undefined | { summary?: string; href?: string },
  queries: [] as Array<{ queryKey: unknown[]; queryFn: () => Promise<unknown> }>,
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => harness.navigate }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: { queryKey: unknown[]; queryFn: () => Promise<unknown> }) => {
    harness.queries.push(options);
    if (harness.loading)
      return { data: undefined, isLoading: true, isFetching: true, refetch: harness.refetch };
    if (harness.failure) return { data: undefined, isError: true, refetch: harness.refetch };
    return {
      data: harness.query
        ? {
            results: [
              {
                id: "model:atlas",
                kind: "model",
                title: "Odia OCR Atlas",
                summary: "Optical character recognition",
                href: "/r/model/atlas",
                source: "catalog",
                score: 100,
                ...harness.resultOverride,
              },
            ],
            partial: false,
            sources: [],
          }
        : undefined,
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: harness.refetch,
    };
  },
}));
vi.mock("../src/components/ui/command", () => ({
  CommandDialog: ({ open, children }: { open: boolean; children?: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
  CommandInput: ({
    onValueChange,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement> & { onValueChange?: (value: string) => void }) => (
    <input {...props} onChange={(event) => onValueChange?.(event.target.value)} />
  ),
  CommandList: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CommandGroup: ({ heading, children }: { heading: string; children?: React.ReactNode }) => (
    <section aria-label={heading}>{children}</section>
  ),
  CommandItem: ({ children, onSelect }: { children?: React.ReactNode; onSelect?: () => void }) => (
    <button onClick={onSelect}>{children}</button>
  ),
}));

describe("command palette dialog", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    harness.navigate.mockClear();
    harness.refetch.mockClear();
    harness.query = undefined;
    harness.resultOverride = undefined;
    harness.loading = false;
    harness.failure = false;
    harness.queries.length = 0;
  });

  it("uses one unified search endpoint and navigates a ranked internal result", async () => {
    harness.query = "atlas";
    const { default: CommandPaletteDialog } =
      await import("../src/components/CommandPaletteDialog");
    render(<CommandPaletteDialog open onOpenChange={() => undefined} />);
    fireEvent.change(screen.getByPlaceholderText("Search all OpenOdia resources…"), {
      target: { value: "atlas" },
    });
    await waitFor(() =>
      expect(harness.queries.at(-1)?.queryKey).toEqual(["palette", "search", "atlas"]),
    );
    expect(screen.getByRole("button", { name: /Odia OCR Atlas/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Odia OCR Atlas/ }));
    expect(harness.navigate).toHaveBeenCalledWith({ to: "/r/model/atlas" });
    const latest = harness.queries.at(-1)!;
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await latest.queryFn();
    expect(fetchMock).toHaveBeenCalledWith("/api/search?q=atlas&limit=50", expect.any(Object));
  });

  it("uses the source label for an empty summary and safely closes a result without a destination", async () => {
    harness.query = "atlas";
    harness.resultOverride = { summary: "", href: undefined };
    const close = vi.fn();
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const { default: CommandPaletteDialog } =
      await import("../src/components/CommandPaletteDialog");
    render(<CommandPaletteDialog open onOpenChange={close} />);
    fireEvent.change(screen.getByPlaceholderText("Search all OpenOdia resources…"), {
      target: { value: "atlas" },
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Odia OCR Atlas/ })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /Odia OCR Atlas/ }));
    expect(screen.getByText("catalog")).toBeInTheDocument();
    expect(close).toHaveBeenCalledWith(false);
    expect(harness.navigate).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });
  it("does not label loading as no results and offers a retry after failure", async () => {
    harness.loading = true;
    const { default: CommandPaletteDialog } =
      await import("../src/components/CommandPaletteDialog");
    const { rerender } = render(<CommandPaletteDialog open onOpenChange={() => undefined} />);
    fireEvent.change(screen.getByPlaceholderText("Search all OpenOdia resources…"), {
      target: { value: "atlas" },
    });
    expect(screen.getByRole("status")).toHaveTextContent("Searching OpenOdia");

    harness.loading = false;
    harness.failure = true;
    rerender(<CommandPaletteDialog open onOpenChange={() => undefined} />);
    expect(screen.getByRole("alert")).toHaveTextContent("temporarily unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(harness.refetch).toHaveBeenCalled();
  });
});

function ShortcutFixture() {
  const ref = useRef<HTMLInputElement>(null);
  useSearchShortcut(ref);
  return (
    <>
      <input ref={ref} aria-label="search" />
      <textarea aria-label="other" />
      <div contentEditable aria-label="editor" />
    </>
  );
}

describe("search shortcut", () => {
  it("handles slash safely before the input ref is attached", () => {
    function PendingSearchInput() {
      const ref = useRef<HTMLInputElement>(null);
      useSearchShortcut(ref);
      return <p>The search input is still mounting.</p>;
    }
    render(<PendingSearchInput />);
    const key = new KeyboardEvent("keydown", { key: "/", cancelable: true });
    window.dispatchEvent(key);
    expect(key.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(document.body);
  });
  it("leaves ordinary keys and Escape in another typing surface alone", () => {
    render(<ShortcutFixture />);
    const textarea = screen.getByRole("textbox", { name: "other" });
    textarea.focus();
    const ordinaryKey = new KeyboardEvent("keydown", { key: "a", cancelable: true });
    window.dispatchEvent(ordinaryKey);
    expect(ordinaryKey.defaultPrevented).toBe(false);
    expect(textarea).toHaveFocus();
    const escape = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
    window.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(false);
    expect(textarea).toHaveFocus();
  });
  it("focuses and selects on slash, ignores typing surfaces, and blurs on Escape", () => {
    render(<ShortcutFixture />);
    const search = screen.getByRole("textbox", { name: "search" }) as HTMLInputElement;
    search.value = "query";
    fireEvent.keyDown(window, { key: "/" });
    expect(search).toHaveFocus();
    expect(search.selectionStart).toBe(0);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(search).not.toHaveFocus();
    const textarea = screen.getByRole("textbox", { name: "other" });
    textarea.focus();
    fireEvent.keyDown(window, { key: "/" });
    expect(textarea).toHaveFocus();
  });
});
