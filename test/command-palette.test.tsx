import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

/**
 * The palette is code-split: cmdk, a Radix dialog, and four upstream fetchers
 * are ~18KB gzipped that used to sit in the entry bundle on every page for a
 * surface most visitors never open.
 *
 * That saving is invisible and silently reversible — dropping the `loaded`
 * gate, or importing the dialog directly instead of through `lazy()`, would
 * put it straight back with nothing failing and no visible difference. So what
 * is asserted is the import boundary itself: with the palette closed the real
 * dialog renders nothing whether or not its module was loaded, which makes the
 * DOM useless as evidence.
 *
 * The stand-in below always renders a root marker and only renders its body
 * when open, so "mounted but closed" and "not mounted" are distinguishable —
 * the real dialog cannot tell those apart either.
 */
const dialog = vi.hoisted(() => ({ imported: false }));

vi.mock("../src/components/CommandPaletteDialog", () => {
  // Runs once, when the lazy() factory first resolves the module. Never reset
  // between tests: the module cache means it can only ever fire once, so the
  // flag answers "has it been loaded yet", and only the first test can observe
  // the not-yet state.
  dialog.imported = true;
  return {
    default: ({ open }: { open: boolean }) => (
      <div data-testid="palette-root">{open ? <div data-testid="palette">palette</div> : null}</div>
    ),
  };
});

// Imported after the mock so the lazy() factory resolves to it.
const { CommandPalette } = await import("../src/components/CommandPalette");

afterEach(cleanup);

const openWithShortcut = () =>
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));

describe("CommandPalette", () => {
  // Must stay first: see the note on `dialog.imported` above.
  it("does not load the dialog until the palette is opened", async () => {
    render(<CommandPalette />);
    // Long enough for a pending dynamic import to have resolved if one was made.
    await new Promise((r) => setTimeout(r, 20));
    expect(dialog.imported).toBe(false);
    expect(screen.queryByTestId("palette-root")).not.toBeInTheDocument();
  });

  it("loads and opens the dialog on the openCommandPalette event", async () => {
    render(<CommandPalette />);
    window.dispatchEvent(new CustomEvent("openCommandPalette"));
    expect(await screen.findByTestId("palette")).toBeInTheDocument();
    expect(dialog.imported).toBe(true);
  });

  it("loads and opens the dialog on ⌘K", async () => {
    render(<CommandPalette />);
    openWithShortcut();
    expect(await screen.findByTestId("palette")).toBeInTheDocument();
  });

  it("loads and opens the dialog on Ctrl+K", async () => {
    render(<CommandPalette />);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
    expect(await screen.findByTestId("palette")).toBeInTheDocument();
  });

  it("ignores a keydown that is neither ⌘K nor Ctrl+K", async () => {
    render(<CommandPalette />);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k" }));
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId("palette-root")).not.toBeInTheDocument();
  });

  it("keeps the dialog mounted once closed, so reopening does not refetch", async () => {
    render(<CommandPalette />);
    openWithShortcut();
    expect(await screen.findByTestId("palette")).toBeInTheDocument();

    openWithShortcut(); // ⌘K toggles
    await waitFor(() => expect(screen.queryByTestId("palette")).not.toBeInTheDocument());
    expect(screen.getByTestId("palette-root")).toBeInTheDocument();
  });
});
