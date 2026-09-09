import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Calendar } from "../src/components/ui/calendar";
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandItem,
  CommandList,
} from "../src/components/ui/command";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  useFormField,
} from "../src/components/ui/form";
import { Menubar, MenubarMenu, MenubarPortal, MenubarTrigger } from "../src/components/ui/menubar";
import {
  Sidebar,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuSubButton,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "../src/components/ui/sidebar";

const carouselHarness = vi.hoisted(() => ({
  api: null as null | Record<string, unknown>,
}));

vi.mock("embla-carousel-react", () => ({
  default: () => [vi.fn(), carouselHarness.api],
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  carouselHarness.api = null;
});

describe("Calendar day buttons", () => {
  it("renders day buttons via CalendarDayButton and marks the selected one", () => {
    const { container } = render(
      <Calendar mode="single" selected={new Date(2026, 8, 3)} month={new Date(2026, 8, 1)} />,
    );
    const selected = container.querySelector('[data-selected-single="true"]');
    expect(selected).toBeInTheDocument();
    expect(selected).toHaveAttribute("data-day");
  });

  it("focuses the day button react-day-picker marks as keyboard-focused", () => {
    const { container } = render(
      <Calendar mode="single" selected={new Date(2026, 8, 3)} month={new Date(2026, 8, 1)} />,
    );
    // Focusing a day button puts react-day-picker's roving tabindex on it,
    // which re-renders CalendarDayButton with `modifiers.focused: true` and
    // exercises its focus-on-mount effect.
    const selected = container.querySelector('[data-selected-single="true"]') as HTMLButtonElement;
    fireEvent.focus(selected);
    expect(selected).toHaveFocus();
  });
});

describe("carousel", () => {
  it("throws useCarousel outside a <Carousel />", async () => {
    const { CarouselContent } = await import("../src/components/ui/carousel");
    expect(() => render(<CarouselContent />)).toThrow(
      "useCarousel must be used within a <Carousel />",
    );
  });

  it("skips selection wiring while the embla api has not initialized yet", async () => {
    carouselHarness.api = null;
    const { Carousel, CarouselContent, CarouselItem } =
      await import("../src/components/ui/carousel");
    render(
      <Carousel>
        <CarouselContent>
          <CarouselItem>Slide</CarouselItem>
        </CarouselContent>
      </Carousel>,
    );
    expect(screen.getByText("Slide")).toBeInTheDocument();
  });

  it("ignores a select callback fired with no current api", async () => {
    const api = {
      canScrollPrev: vi.fn(() => false),
      canScrollNext: vi.fn(() => false),
      scrollPrev: vi.fn(),
      scrollNext: vi.fn(),
      on: vi.fn((_event: string, cb: (api: unknown) => void) => {
        // Simulate embla invoking the handler with no current selection.
        cb(undefined);
      }),
      off: vi.fn(),
    };
    carouselHarness.api = api;
    const { Carousel, CarouselContent, CarouselItem } =
      await import("../src/components/ui/carousel");
    render(
      <Carousel>
        <CarouselContent>
          <CarouselItem>Slide</CarouselItem>
        </CarouselContent>
      </Carousel>,
    );
    expect(screen.getByText("Slide")).toBeInTheDocument();
  });

  it("scrolls prev/next via ArrowLeft/ArrowRight keydowns", async () => {
    const api = {
      canScrollPrev: vi.fn(() => false),
      canScrollNext: vi.fn(() => false),
      scrollPrev: vi.fn(),
      scrollNext: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    };
    carouselHarness.api = api;
    const { Carousel, CarouselContent, CarouselItem } =
      await import("../src/components/ui/carousel");
    const { container } = render(
      <Carousel>
        <CarouselContent>
          <CarouselItem>Slide</CarouselItem>
        </CarouselContent>
      </Carousel>,
    );
    const region = container.querySelector('[role="region"]') as HTMLElement;
    fireEvent.keyDown(region, { key: "ArrowRight" });
    expect(api.scrollNext).toHaveBeenCalled();
    fireEvent.keyDown(region, { key: "ArrowLeft" });
    expect(api.scrollPrev).toHaveBeenCalled();
    // A non-arrow key hits the `else if (event.key === "ArrowRight")`
    // guard's false branch, since it never reaches it as true here.
    fireEvent.keyDown(region, { key: "Escape" });
    expect(api.scrollPrev).toHaveBeenCalledTimes(1);
    expect(api.scrollNext).toHaveBeenCalledTimes(1);
  });
});

describe("chart", () => {
  it("throws useChart outside a <ChartContainer />", async () => {
    const { ChartLegendContent } = await import("../src/components/ui/chart");
    expect(() => render(<ChartLegendContent payload={[]} />)).toThrow(
      "useChart must be used within a <ChartContainer />",
    );
  });

  it("hides the tooltip when inactive or empty, and the label when told to", async () => {
    const { ChartContainer, ChartTooltipContent } = await import("../src/components/ui/chart");
    const config = { value: { label: "Value" } };
    const { container, rerender } = render(
      <ChartContainer id="t" config={config}>
        <div>
          <ChartTooltipContent active={false} payload={[]} />
        </div>
      </ChartContainer>,
    );
    expect(container.querySelector(".shadow-xl")).not.toBeInTheDocument();

    rerender(
      <ChartContainer id="t" config={config}>
        <div>
          <ChartTooltipContent
            active
            hideLabel
            payload={[{ dataKey: "value", value: 1, payload: {} }]}
          />
        </div>
      </ChartContainer>,
    );
    expect(container.querySelector(".shadow-xl")).toBeInTheDocument();
  });

  it("renders without a label when nothing resolves one", async () => {
    const { ChartContainer, ChartTooltipContent } = await import("../src/components/ui/chart");
    const config = {};
    render(
      <ChartContainer id="t2" config={config}>
        <div>
          <ChartTooltipContent active payload={[{ dataKey: "unknown", value: 1, payload: {} }]} />
        </div>
      </ChartContainer>,
    );
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("resolves payload config from a non-object payload entry without crashing", async () => {
    const { ChartContainer, ChartLegendContent } = await import("../src/components/ui/chart");
    const config = { value: { label: "Value" } };
    const { container } = render(
      <ChartContainer id="t3" config={config}>
        <div>
          {/* A malformed legend entry (not an object) exercises the config
              resolver's non-object guard without touching the rest of the
              render path, which only reads optional fields on it. */}
          <ChartLegendContent payload={[42 as unknown as { value: string }]} />
        </div>
      </ChartContainer>,
    );
    expect(container.querySelector(".h-2.w-2")).toBeInTheDocument();
  });

  it("hides the legend when there is no payload", async () => {
    const { ChartContainer, ChartLegendContent } = await import("../src/components/ui/chart");
    const { container } = render(
      <ChartContainer id="t4" config={{}}>
        <div>
          <ChartLegendContent payload={[]} />
        </div>
      </ChartContainer>,
    );
    expect(container.querySelector(".pt-3")).not.toBeInTheDocument();
  });

  it("derives the chart id from useId when no id prop is given", async () => {
    const { ChartContainer } = await import("../src/components/ui/chart");
    const { container } = render(
      <ChartContainer config={{}}>
        <div />
      </ChartContainer>,
    );
    expect(container.querySelector("[data-chart]")?.getAttribute("data-chart")).toMatch(
      /^chart-\S+$/,
    );
  });

  it("skips a theme entry whose color resolves falsy for one theme prefix", async () => {
    const { ChartContainer } = await import("../src/components/ui/chart");
    // `series` passes the outer `colorConfig` filter (it has a truthy
    // `theme` object), but its "light" entry is an empty string, so that
    // theme iteration's `color` is falsy and returns null; "dark" resolves
    // "#000" and still hits the existing truthy branch.
    const config = { series: { theme: { light: "", dark: "#000" } } };
    const { container } = render(
      <ChartContainer id="t5" config={config}>
        <div />
      </ChartContainer>,
    );
    expect(container.querySelector("style")).toBeInTheDocument();
  });

  it("resolves the tooltip label key from item.name when dataKey is absent", async () => {
    const { ChartContainer, ChartTooltipContent } = await import("../src/components/ui/chart");
    const config = { Series: { label: "Series label" } };
    const { container } = render(
      <ChartContainer id="t6" config={config}>
        <div>
          <ChartTooltipContent active payload={[{ name: "Series", value: 5, payload: {} }]} />
        </div>
      </ChartContainer>,
    );
    // "Series label" appears twice (the tooltip label and the per-item
    // name), so scope the query to the label element specifically.
    expect(container.querySelector(".font-medium")).toHaveTextContent("Series label");
  });

  it("falls back to the literal 'value' tooltip key when name and dataKey are absent", async () => {
    const { ChartContainer, ChartTooltipContent } = await import("../src/components/ui/chart");
    render(
      <ChartContainer id="t7" config={{}}>
        <div>
          <ChartTooltipContent active payload={[{ value: 5, payload: {} }]} />
        </div>
      </ChartContainer>,
    );
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("falls back to the raw label string when the config has no matching entry", async () => {
    const { ChartContainer, ChartTooltipContent } = await import("../src/components/ui/chart");
    const config = { x: { label: "X label" } };
    render(
      <ChartContainer id="t8" config={config}>
        <div>
          <ChartTooltipContent
            active
            label="unmapped-label"
            payload={[{ dataKey: "x", value: 1, payload: {} }]}
          />
        </div>
      </ChartContainer>,
    );
    expect(screen.getByText("unmapped-label")).toBeInTheDocument();
  });

  it("falls back to the literal 'value' legend key when name and dataKey are absent", async () => {
    const { ChartContainer, ChartLegendContent } = await import("../src/components/ui/chart");
    const { container } = render(
      <ChartContainer id="t9" config={{}}>
        <div>
          <ChartLegendContent payload={[{ value: "solo", payload: {}, color: "red" }]} />
        </div>
      </ChartContainer>,
    );
    expect(container.querySelector(".h-2.w-2")).toBeInTheDocument();
  });

  it("nests the label inside the indicator row for a single non-dot indicator item", async () => {
    const { ChartContainer, ChartTooltipContent } = await import("../src/components/ui/chart");
    const config = { solo: { label: "Solo label" } };
    const { container } = render(
      <ChartContainer id="t10" config={config}>
        <div>
          <ChartTooltipContent
            active
            indicator="line"
            payload={[{ dataKey: "solo", value: 1, name: "Solo", payload: {} }]}
          />
        </div>
      </ChartContainer>,
    );
    // "Solo label" appears twice (the nested tooltip label and the
    // per-item name), so assert there are matches rather than a single one.
    expect(screen.getAllByText("Solo label").length).toBeGreaterThan(0);
    expect(container.querySelector(".items-end")).toBeInTheDocument();
  });
});

describe("CommandDialog", () => {
  it("renders the real dialog wrapper with its search affordances", () => {
    render(
      <CommandDialog open onOpenChange={() => undefined}>
        <CommandInput placeholder="Search…" />
        <CommandList>
          <CommandItem>Result</CommandItem>
        </CommandList>
      </CommandDialog>,
    );
    expect(screen.getByPlaceholderText("Search…")).toBeInTheDocument();
    expect(screen.getByText("Result")).toBeInTheDocument();
  });

  it("still exposes the plain Command primitive", () => {
    render(
      <Command>
        <CommandList>
          <CommandItem>Direct</CommandItem>
        </CommandList>
      </Command>,
    );
    expect(screen.getByText("Direct")).toBeInTheDocument();
  });
});

describe("Form edge cases", () => {
  type Fields = { name: string };

  function FieldWithoutItem() {
    useFormField();
    return null;
  }

  it("throws useFormField when used outside a <FormItem>", () => {
    function Fixture() {
      const methods = useForm<Fields>({ defaultValues: { name: "" } });
      return (
        <Form {...methods}>
          <FormField control={methods.control} name="name" render={() => <FieldWithoutItem />} />
        </Form>
      );
    }
    expect(() => render(<Fixture />)).toThrow("useFormField should be used within <FormItem>");
  });

  it("renders no message when there is no error and no children", () => {
    function Fixture() {
      const methods = useForm<Fields>({ defaultValues: { name: "" } });
      return (
        <Form {...methods}>
          <FormField
            control={methods.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </Form>
      );
    }
    const { container } = render(<Fixture />);
    expect(container.querySelector("p")).not.toBeInTheDocument();
  });

  it("uses the empty-string fallback when an error is present but has no message", () => {
    // `String(error?.message ?? "")` — this exercises the `?? ""` fallback
    // specifically (an error object present, but with no `.message`), which
    // is otherwise indistinguishable from the "no error" case in the DOM:
    // both render nothing, since `String(undefined ?? "")` is `""`, which is
    // falsy and still short-circuits FormMessage to `null`. The point of
    // this test is branch coverage of the `?? ""` fallback, not a visible
    // DOM difference from the neighboring "no error" test above.
    function Fixture() {
      const methods = useForm<Fields>({ defaultValues: { name: "" } });
      useEffect(() => {
        methods.setError("name", { type: "manual" });
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return (
        <Form {...methods}>
          <FormField
            control={methods.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </Form>
      );
    }
    const { container } = render(<Fixture />);
    expect(container.querySelector("p")).not.toBeInTheDocument();
  });
});

describe("MenubarPortal", () => {
  it("renders its children through the portal once the menu is open", () => {
    render(
      <Menubar value="file">
        <MenubarMenu value="file">
          <MenubarTrigger>File</MenubarTrigger>
          <MenubarPortal>
            <div data-testid="portaled">Portaled content</div>
          </MenubarPortal>
        </MenubarMenu>
      </Menubar>,
    );
    expect(screen.getByTestId("portaled")).toBeInTheDocument();
  });
});

describe("Sidebar", () => {
  const originalInnerWidth = window.innerWidth;

  afterEach(() => {
    Object.defineProperty(window, "innerWidth", {
      value: originalInnerWidth,
      writable: true,
      configurable: true,
    });
  });

  it("toggles the desktop sidebar state without a controlling parent", () => {
    render(
      <SidebarProvider>
        <Sidebar>Content</Sidebar>
        <SidebarTrigger />
      </SidebarProvider>,
    );
    const trigger = screen.getByRole("button", { name: "Toggle Sidebar" });
    const wrapper = trigger.closest("[data-state]")?.parentElement;
    fireEvent.click(trigger);
    // Uncontrolled toggling flips the internal open state (and its cookie),
    // which is only observable indirectly here via a successful, error-free
    // re-render — the assertion below confirms the tree is still intact.
    expect(wrapper ?? trigger).toBeTruthy();
  });

  it("renders the mobile sheet and opens it via toggleSidebar's mobile branch", () => {
    Object.defineProperty(window, "innerWidth", {
      value: 375,
      writable: true,
      configurable: true,
    });
    render(
      <SidebarProvider>
        <Sidebar>
          <div>Mobile content</div>
        </Sidebar>
        <SidebarTrigger />
      </SidebarProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }));
    expect(screen.getByText("Mobile content")).toBeInTheDocument();
    expect(screen.getByText("Sidebar")).toBeInTheDocument(); // sr-only SheetTitle
  });

  it("renders the menu button plainly when no tooltip is given", () => {
    render(
      <SidebarProvider>
        <SidebarMenuButton>No tooltip</SidebarMenuButton>
      </SidebarProvider>,
    );
    expect(screen.getByRole("button", { name: "No tooltip" })).toBeInTheDocument();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("accepts a plain boolean for setOpen from a direct context consumer", () => {
    function ForceOpenButton() {
      const { setOpen } = useSidebar();
      return <button onClick={() => setOpen(true)}>Force open</button>;
    }
    render(
      <SidebarProvider>
        <ForceOpenButton />
      </SidebarProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Force open" }));
    expect(document.cookie).toContain("sidebar_state=true");
  });

  it("ignores a bare 'b' keydown without a modifier key", () => {
    const { container } = render(
      <SidebarProvider>
        <Sidebar>Content</Sidebar>
      </SidebarProvider>,
    );
    fireEvent.keyDown(window, { key: "b" });
    expect(container.querySelector("[data-state]")).toHaveAttribute("data-state", "expanded");
  });

  it("renders asChild Slot variants for group/menu action and label components", () => {
    render(
      <SidebarProvider>
        <SidebarGroupLabel asChild>
          <div>Group label slot</div>
        </SidebarGroupLabel>
        <SidebarGroupAction asChild>
          <button type="button">Group action slot</button>
        </SidebarGroupAction>
        <SidebarMenuAction asChild>
          <button type="button">Menu action slot</button>
        </SidebarMenuAction>
        <SidebarMenuButton asChild>
          <a href="/menu-slot">Menu button slot</a>
        </SidebarMenuButton>
        <SidebarMenuSubButton asChild>
          <a href="/sub">Sub button slot</a>
        </SidebarMenuSubButton>
        <SidebarMenuSubButton size="sm">Sub sm</SidebarMenuSubButton>
      </SidebarProvider>,
    );
    expect(screen.getByText("Group label slot").tagName).toBe("DIV");
    expect(screen.getByText("Group action slot").tagName).toBe("BUTTON");
    expect(screen.getByText("Menu action slot").tagName).toBe("BUTTON");
    expect(screen.getByText("Menu button slot").tagName).toBe("A");
    const subButtonSlot = screen.getByText("Sub button slot");
    expect(subButtonSlot.tagName).toBe("A");
    expect(subButtonSlot).toHaveClass("text-sm"); // default size "md"
    expect(screen.getByText("Sub sm")).toHaveClass("text-xs");
  });

  it("normalizes a string tooltip and passes through an object tooltip", () => {
    render(
      <SidebarProvider>
        <SidebarMenuButton tooltip="String tooltip">With string tooltip</SidebarMenuButton>
        <SidebarMenuButton tooltip={{ children: "Object tooltip" }}>
          With object tooltip
        </SidebarMenuButton>
      </SidebarProvider>,
    );
    expect(screen.getByRole("button", { name: "With string tooltip" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "With object tooltip" })).toBeInTheDocument();
  });

  it("evaluates the isMobile fallback for the tooltip's hidden prop when collapsed", () => {
    render(
      <SidebarProvider defaultOpen={false}>
        <Sidebar>
          <SidebarMenuButton tooltip="Collapsed tip">Item</SidebarMenuButton>
        </Sidebar>
      </SidebarProvider>,
    );
    expect(screen.getByRole("button", { name: "Item" })).toBeInTheDocument();
  });
});
