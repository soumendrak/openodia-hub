import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// `ResourceMeta`'s mount effect reads `ref.current?.open` to adopt a
// <details> that a pre-hydration click already opened natively (see the
// component's own comment). Reproducing that requires the DOM node's `open`
// property to already be true *before* the effect runs — i.e. at the moment
// React attaches the ref during commit, ahead of the passive-effect flush.
// The real `useRef` is still called on every render (so React's hook-order
// bookkeeping stays intact across the effect's own `setOpen` update); only
// the `current` property of the *same* persistent ref object it returns is
// redefined so that assigning a <details> node to it also forces `.open`
// true. Every other `useRef` call in this file (the harness stays inactive
// by default) is untouched.
const detailsOpenHarness = vi.hoisted(() => ({ active: false }));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useRef: (initial?: unknown) => {
      const ref = actual.useRef(initial);
      if (!detailsOpenHarness.active) return ref;
      const patched = ref as { __detailsOpenPatched?: boolean };
      if (!patched.__detailsOpenPatched) {
        patched.__detailsOpenPatched = true;
        let value = ref.current;
        Object.defineProperty(ref, "current", {
          configurable: true,
          get: () => value,
          set: (v: unknown) => {
            if (v && typeof v === "object" && "open" in v) {
              try {
                (v as HTMLDetailsElement).open = true;
              } catch {
                // ignore — defensive only, mirrors the component's own intent
              }
            }
            value = v;
          },
        });
      }
      return ref;
    },
  };
});

import {
  ActiveFilterBar,
  Chip,
  EmptyResults,
  FacetGroup,
  ResultCount,
} from "../src/components/Facets";
import { LicenseBadge, ResourceMeta } from "../src/components/ResourceMeta";
import { GithubIcon, LinkedinIcon, PythonIcon, YoutubeIcon } from "../src/components/icons";
import type { ActiveFilter } from "../src/lib/facets";

afterEach(cleanup);

describe("Chip", () => {
  it("renders active, disabled, and plain states and forwards clicks", () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <Chip active onClick={onClick} ariaLabel="active chip" title="Active">
        Active
      </Chip>,
    );
    const button = screen.getByRole("button", { name: "active chip" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <Chip disabled ariaLabel="disabled chip">
        Disabled
      </Chip>,
    );
    expect(screen.getByRole("button", { name: "disabled chip" })).toBeDisabled();

    rerender(<Chip>Plain</Chip>);
    expect(screen.getByText("Plain")).toBeInTheDocument();
  });
});

describe("FacetGroup edge cases", () => {
  it("renders nothing when there are no options", () => {
    const { container } = render(
      <FacetGroup title="Empty" options={[]} selected={new Set()} onToggle={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("clears the search query when the popover closes", () => {
    render(
      <FacetGroup
        title="Task"
        options={[
          { value: "one", label: "One", count: 3 },
          { value: "two", label: "Two", count: 2 },
        ]}
        selected={new Set()}
        onToggle={vi.fn()}
        limit={1}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Filter by Task" });
    fireEvent.click(trigger);
    fireEvent.change(screen.getByPlaceholderText("Search task…"), {
      target: { value: "two" },
    });
    expect(screen.getByRole("button", { name: "Two (2)" })).toBeInTheDocument();
    // Closing the popover (re-clicking the trigger) should clear the query.
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(screen.queryByPlaceholderText("Search task…")).toHaveValue("");
  });

  it("disables an option the current combination has put out of reach", () => {
    const onToggle = vi.fn();
    render(
      <FacetGroup
        title="Task"
        options={[
          { value: "one", label: "One", count: 3 },
          { value: "gone", label: "Gone", count: 0 },
        ]}
        selected={new Set()}
        onToggle={onToggle}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Filter by Task" }));

    const unreachable = screen.getByRole("button", { name: "Gone (0)" });
    expect(unreachable).toBeDisabled();
    fireEvent.click(unreachable);
    expect(onToggle).not.toHaveBeenCalled();

    const available = screen.getByRole("button", { name: "One (3)" });
    expect(available).not.toBeDisabled();
    fireEvent.click(available);
    expect(onToggle).toHaveBeenCalledWith("one");
  });

  it("shows a no-matches message when the facet search finds nothing", () => {
    render(
      <FacetGroup
        title="Task"
        options={[
          { value: "one", label: "One", count: 3 },
          { value: "two", label: "Two", count: 2 },
        ]}
        selected={new Set()}
        onToggle={vi.fn()}
        limit={1}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Filter by Task" }));
    fireEvent.change(screen.getByPlaceholderText("Search task…"), {
      target: { value: "zzz" },
    });
    expect(screen.getByText(/No task filters match/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /One|Two/ })).not.toBeInTheDocument();
  });
});

describe("ActiveFilterBar", () => {
  it("renders nothing when there are no active filters", () => {
    const { container } = render(
      <ActiveFilterBar filters={[]} onRemove={vi.fn()} onClearAll={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders each filter chip and calls onRemove and onClearAll", () => {
    const onRemove = vi.fn();
    const onClearAll = vi.fn();
    const filters: ActiveFilter[] = [
      { facet: "task", value: "asr", label: "ASR" },
      { facet: "task", value: "tts", label: "TTS" },
    ];
    render(<ActiveFilterBar filters={filters} onRemove={onRemove} onClearAll={onClearAll} />);
    expect(screen.getByText("ASR")).toBeInTheDocument();
    expect(screen.getByText("TTS")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove filter ASR" }));
    expect(onRemove).toHaveBeenCalledWith(filters[0]);
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(onClearAll).toHaveBeenCalled();
  });
});

describe("EmptyResults", () => {
  it("names the query and filters and offers to clear them", () => {
    const onClearAll = vi.fn();
    const filters: ActiveFilter[] = [{ facet: "task", value: "asr", label: "ASR" }];
    render(<EmptyResults query="hello" filters={filters} onClearAll={onClearAll} noun="tools" />);
    expect(screen.getByText(/"hello" \+ ASR/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onClearAll).toHaveBeenCalled();
  });

  it("falls back to a generic message with no query or filters", () => {
    render(<EmptyResults query="" filters={[]} onClearAll={vi.fn()} noun="tools" />);
    expect(screen.getByText(/the current filters/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers to clear just the search when only a query is present", () => {
    render(<EmptyResults query="hello" filters={[]} onClearAll={vi.fn()} noun="tools" />);
    expect(screen.getByRole("button", { name: "Clear search" })).toBeInTheDocument();
  });
});

describe("ResultCount", () => {
  it("announces the shown and total counts", () => {
    render(<ResultCount shown={3} total={10} noun="tools" />);
    expect(screen.getByRole("status")).toHaveTextContent("Showing 3 of 10 tools");
  });
});

describe("LicenseBadge", () => {
  it("shows a 'No license' badge when spdx is empty", () => {
    render(<LicenseBadge spdx="" />);
    expect(screen.getByText("No license")).toBeInTheDocument();
  });

  it("marks non-permissive licenses distinctly from permissive ones", () => {
    const { rerender } = render(<LicenseBadge spdx="MIT" />);
    expect(screen.getByText("MIT")).toHaveAttribute("title", expect.stringContaining("permissive"));
    rerender(<LicenseBadge spdx="CC-BY-NC-4.0" />);
    expect(screen.getByText("CC-BY-NC-4.0")).toHaveAttribute(
      "title",
      expect.stringContaining("check the terms"),
    );
  });
});

describe("ResourceMeta copy buttons", () => {
  const entry = {
    name: "Sua",
    author: "soumendrak",
    url: "https://github.com/soumendrak/sua",
    createdAt: "2024-01-01T00:00:00Z",
  };

  it("copies citation text and resets the copied state", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const { container } = render(<ResourceMeta license="MIT" entry={entry} />);
    const details = container.querySelector("details") as HTMLDetailsElement;
    details.open = true;
    details.dispatchEvent(new Event("toggle"));

    const [bibtexCopy] = await screen.findAllByRole("button", { name: "Copy" });
    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(bibtexCopy);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalled();
    expect(screen.getAllByText("Copied").length).toBeGreaterThan(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(screen.queryByText("Copied")).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("falls back gracefully when the clipboard write fails", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const { container } = render(<ResourceMeta license="MIT" entry={entry} />);
    const details = container.querySelector("details") as HTMLDetailsElement;
    details.open = true;
    details.dispatchEvent(new Event("toggle"));

    const [bibtexCopy] = await screen.findAllByRole("button", { name: "Copy" });
    await act(async () => {
      fireEvent.click(bibtexCopy);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalled();
    expect(screen.queryAllByText("Copied")).toHaveLength(0);
  });
});

describe("ResourceMeta pre-hydration disclosure adoption", () => {
  const entry = {
    name: "Sua",
    author: "soumendrak",
    url: "https://github.com/soumendrak/sua",
    createdAt: "2024-01-01T00:00:00Z",
  };

  afterEach(() => {
    detailsOpenHarness.active = false;
  });

  it("adopts an already-open <details> element on mount without a click", async () => {
    detailsOpenHarness.active = true;
    const { container } = render(<ResourceMeta license="MIT" entry={entry} />);
    detailsOpenHarness.active = false;

    const details = container.querySelector("details") as HTMLDetailsElement;
    expect(details.open).toBe(true);
    // The mount effect saw the DOM's already-open state and set React's
    // `open` state to true — the disclosure body renders with no click.
    expect(await screen.findByText("BibTeX")).toBeInTheDocument();
  });

  it("leaves the disclosure closed on a normal mount", () => {
    const { container } = render(<ResourceMeta license="MIT" entry={entry} />);
    const details = container.querySelector("details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(screen.queryByText("BibTeX")).not.toBeInTheDocument();
  });
});

describe("icons", () => {
  it("renders the LinkedIn icon with a custom size and class", () => {
    const { container } = render(<LinkedinIcon size={24} className="text-neon" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "24");
    expect(svg).toHaveClass("text-neon");
  });

  it("renders the remaining brand icons at their defaults", () => {
    const { container } = render(
      <>
        <GithubIcon />
        <YoutubeIcon />
        <PythonIcon />
      </>,
    );
    expect(container.querySelectorAll("svg")).toHaveLength(3);
  });
});
