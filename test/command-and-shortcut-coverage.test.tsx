import { fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSearchShortcut } from "../src/hooks/useSearchShortcut";

const commandHarness = vi.hoisted(() => {
  const defaultRepos = [
    {
      full_name: "org/repo",
      name: "repo",
      html_url: "https://repo",
      description: "Repo description",
      language: "TypeScript",
      topics: ["odia"],
    },
  ];
  const defaultVideos = [
    { name: "Channel", videos: [{ id: "video", title: "Tutorial", channelName: "" }] },
  ];
  return {
    navigate: vi.fn(),
    queries: [] as Array<{ queryKey: string[]; queryFn: () => Promise<unknown> }>,
    // When true, every useQuery mock returns `{ data: undefined }` — exercises
    // the `?? []` fallbacks in CommandPaletteDialog while queries are loading.
    loading: false,
    defaultRepos,
    defaultVideos,
    repos: defaultRepos as unknown[],
    videos: defaultVideos as unknown[],
  };
});

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => commandHarness.navigate }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: { queryKey: string[]; queryFn: () => Promise<unknown> }) => {
    commandHarness.queries.push(options);
    if (commandHarness.loading) return { data: undefined };
    const key = options.queryKey[1];
    if (key === "repos") return { data: { repos: commandHarness.repos } };
    if (key === "tools")
      return {
        data: {
          items: [{ name: "Tool", url: "https://tool", description: "Useful", category: "NLP" }],
        },
      };
    if (key === "videos") return { data: { channels: commandHarness.videos } };
    return {
      data: {
        events: [
          { title: "Meetup", url: "https://event", description: "Meet", community: "OpenOdia" },
        ],
      },
    };
  },
}));
vi.mock("../src/components/ui/command", () => ({
  CommandDialog: ({ open, children }: { open: boolean; children?: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
  CommandInput: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  CommandList: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CommandEmpty: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
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
    commandHarness.navigate.mockClear();
    commandHarness.queries.length = 0;
    commandHarness.loading = false;
    commandHarness.repos = commandHarness.defaultRepos;
    commandHarness.videos = commandHarness.defaultVideos;
  });

  it("renders every result group and handles internal and external selection", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const onOpenChange = vi.fn();
    const { default: CommandPaletteDialog } =
      await import("../src/components/CommandPaletteDialog");
    render(<CommandPaletteDialog open onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(commandHarness.navigate).toHaveBeenCalledWith({ to: "/" });
    for (const name of ["org/repoRepo description", "ToolNLP", "Tutorial", "MeetupOpenOdia"]) {
      fireEvent.click(screen.getByRole("button", { name }));
    }
    expect(open).toHaveBeenCalledWith("https://repo", "_blank", "noreferrer");
    expect(open).toHaveBeenCalledWith(
      "https://www.youtube.com/watch?v=video",
      "_blank",
      "noreferrer",
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("skips window.open when window is undefined (SSR) during external selection", async () => {
    const onOpenChange = vi.fn();
    const { default: CommandPaletteDialog } =
      await import("../src/components/CommandPaletteDialog");
    render(<CommandPaletteDialog open onOpenChange={onOpenChange} />);

    vi.stubGlobal("window", undefined);
    try {
      expect(() =>
        screen.getByRole("button", { name: "org/repoRepo description" }).click(),
      ).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("uses the documented API loaders and rejects non-OK responses", async () => {
    const { default: CommandPaletteDialog } =
      await import("../src/components/CommandPaletteDialog");
    render(<CommandPaletteDialog open onOpenChange={() => undefined} />);
    const fetchMock = vi.fn().mockImplementation(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    for (const query of commandHarness.queries) await expect(query.queryFn()).resolves.toEqual({});
    expect(fetchMock).toHaveBeenCalledTimes(4);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => new Response("no", { status: 503 })),
    );
    for (const query of commandHarness.queries) await expect(query.queryFn()).rejects.toThrow();
  });

  it("falls back to empty result groups while queries are still loading", async () => {
    commandHarness.loading = true;
    const { default: CommandPaletteDialog } =
      await import("../src/components/CommandPaletteDialog");
    render(<CommandPaletteDialog open onOpenChange={() => undefined} />);

    expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument();
    expect(screen.queryByText(/org\/repo/)).not.toBeInTheDocument();
    expect(screen.queryByText("Tool")).not.toBeInTheDocument();
    expect(screen.queryByText("Tutorial")).not.toBeInTheDocument();
    expect(screen.queryByText("Meetup")).not.toBeInTheDocument();
  });

  it("falls back to the channel name when a video has no channelName", async () => {
    commandHarness.videos = [
      { name: "Channel", videos: [{ id: "no-channel-name", title: "Untitled tutorial" }] },
    ];
    const { default: CommandPaletteDialog } =
      await import("../src/components/CommandPaletteDialog");
    render(<CommandPaletteDialog open onOpenChange={() => undefined} />);

    expect(screen.getByRole("button", { name: "Untitled tutorialChannel" })).toBeInTheDocument();
  });

  it("renders a repo item with no description, language, or topics", async () => {
    commandHarness.repos = [{ full_name: "org/bare", name: "bare", html_url: "https://bare" }];
    const { default: CommandPaletteDialog } =
      await import("../src/components/CommandPaletteDialog");
    render(<CommandPaletteDialog open onOpenChange={() => undefined} />);

    expect(screen.getByRole("button", { name: "org/bare" })).toBeInTheDocument();
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
    const editor = screen.getByLabelText("editor");
    editor.focus();
    fireEvent.keyDown(window, { key: "/" });
    expect(editor).toHaveFocus();
  });

  it("ignores keys that are neither slash nor Escape", () => {
    render(<ShortcutFixture />);
    const search = screen.getByRole("textbox", { name: "search" }) as HTMLInputElement;
    search.focus();
    expect(() => fireEvent.keyDown(window, { key: "a" })).not.toThrow();
    expect(search).toHaveFocus();
  });

  it("does not blur the search input on Escape when it is not the focused element", () => {
    render(<ShortcutFixture />);
    const search = screen.getByRole("textbox", { name: "search" }) as HTMLInputElement;
    const textarea = screen.getByRole("textbox", { name: "other" });
    textarea.focus();
    expect(() => fireEvent.keyDown(window, { key: "Escape" })).not.toThrow();
    expect(textarea).toHaveFocus();
    expect(search).not.toHaveFocus();
  });
});
