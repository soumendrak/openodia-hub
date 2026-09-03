import { fireEvent, render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
} from "../src/components/ui/form";

const complexHarness = vi.hoisted(() => {
  const api = {
    canScrollPrev: vi.fn(() => true),
    canScrollNext: vi.fn(() => true),
    scrollPrev: vi.fn(),
    scrollNext: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  };
  api.on.mockImplementation((_event, callback) => {
    callback(api);
    return api;
  });
  return { api, carouselRef: vi.fn() };
});

vi.mock("embla-carousel-react", () => ({
  default: () => [complexHarness.carouselRef, complexHarness.api],
}));

vi.mock("recharts", async () => {
  const React = await import("react");
  return {
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    Tooltip: () => null,
    Legend: () => null,
  };
});

describe("complex UI wrappers", () => {
  it("covers horizontal and vertical carousel controls", async () => {
    const { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } =
      await import("../src/components/ui/carousel");
    const setApi = vi.fn();
    const { rerender } = render(
      <Carousel setApi={setApi}>
        <CarouselContent>
          <CarouselItem>Slide</CarouselItem>
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>,
    );
    expect(setApi).toHaveBeenCalledWith(complexHarness.api);
    fireEvent.keyDown(screen.getByRole("region"), { key: "ArrowLeft" });
    fireEvent.keyDown(screen.getByRole("region"), { key: "ArrowRight" });
    fireEvent.click(screen.getByRole("button", { name: "Previous slide" }));
    fireEvent.click(screen.getByRole("button", { name: "Next slide" }));
    expect(complexHarness.api.scrollPrev).toHaveBeenCalled();
    expect(complexHarness.api.scrollNext).toHaveBeenCalled();

    rerender(
      <Carousel orientation="vertical">
        <CarouselContent>
          <CarouselItem>Vertical</CarouselItem>
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>,
    );
    expect(screen.getByText("Vertical")).toBeInTheDocument();
  });

  it("renders chart styles, tooltips, legends, icons, and formatters", async () => {
    const { ChartContainer, ChartLegendContent, ChartStyle, ChartTooltipContent } =
      await import("../src/components/ui/chart");
    const Icon = () => <svg aria-label="series icon" />;
    const config = {
      value: { label: "Value", color: "red", icon: Icon },
      themed: { label: "Themed", theme: { light: "blue", dark: "navy" } },
    };
    const payload = [
      {
        dataKey: "value",
        name: "value",
        value: 123,
        color: "red",
        payload: { fill: "red", value: "value" },
      },
    ];
    render(
      <ChartContainer id="test" config={config}>
        <div>
          <ChartTooltipContent active payload={payload} label="value" />
          <ChartTooltipContent
            active
            payload={payload}
            indicator="line"
            labelFormatter={(value) => `Label ${value}`}
            formatter={(value) => <span>Formatted {String(value)}</span>}
          />
          <ChartLegendContent
            verticalAlign="top"
            payload={[{ dataKey: "value", value: "value", color: "red", type: "square" }]}
          />
        </div>
      </ChartContainer>,
    );
    expect(screen.getAllByText("Value")).toHaveLength(3);
    expect(screen.getByText("Formatted 123")).toBeInTheDocument();
    expect(screen.getAllByLabelText("series icon")).toHaveLength(2);

    const { container } = render(<ChartStyle id="empty" config={{ empty: {} }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders and toggles every sidebar building block", async () => {
    const sidebar = await import("../src/components/ui/sidebar");
    const {
      Sidebar,
      SidebarContent,
      SidebarFooter,
      SidebarGroup,
      SidebarGroupAction,
      SidebarGroupContent,
      SidebarGroupLabel,
      SidebarHeader,
      SidebarInput,
      SidebarInset,
      SidebarMenu,
      SidebarMenuAction,
      SidebarMenuBadge,
      SidebarMenuButton,
      SidebarMenuItem,
      SidebarMenuSkeleton,
      SidebarMenuSub,
      SidebarMenuSubButton,
      SidebarMenuSubItem,
      SidebarProvider,
      SidebarRail,
      SidebarSeparator,
      SidebarTrigger,
    } = sidebar;
    const onOpenChange = vi.fn();
    render(
      <SidebarProvider defaultOpen onOpenChange={onOpenChange}>
        <Sidebar side="right" variant="floating" collapsible="icon">
          <SidebarHeader>
            <SidebarInput aria-label="sidebar search" />
          </SidebarHeader>
          <SidebarSeparator />
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Group</SidebarGroupLabel>
              <SidebarGroupAction>+</SidebarGroupAction>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton tooltip="Tooltip" isActive variant="outline" size="lg">
                      Menu
                    </SidebarMenuButton>
                    <SidebarMenuAction showOnHover>Action</SidebarMenuAction>
                    <SidebarMenuBadge>2</SidebarMenuBadge>
                    <SidebarMenuSkeleton showIcon />
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton href="#sub" size="sm" isActive>
                          Sub
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>Footer</SidebarFooter>
          <SidebarRail />
        </Sidebar>
        <SidebarInset>
          <SidebarTrigger />
        </SidebarInset>
      </SidebarProvider>,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Toggle Sidebar" })[1]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    expect(onOpenChange).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Sub")).toBeInTheDocument();
  });

  it("renders non-collapsible sidebar and rejects hooks outside the provider", async () => {
    const { Sidebar, SidebarProvider, useSidebar } = await import("../src/components/ui/sidebar");
    render(
      <SidebarProvider>
        <Sidebar collapsible="none">Always</Sidebar>
      </SidebarProvider>,
    );
    expect(screen.getByText("Always")).toBeInTheDocument();
    function Invalid() {
      useSidebar();
      return null;
    }
    expect(() => render(<Invalid />)).toThrow("useSidebar must be used within a SidebarProvider");
  });
});

type Fields = { name: string };

function FormFixture() {
  const methods = useForm<Fields>({ defaultValues: { name: "" } });
  return (
    <Form {...methods}>
      <FormField
        control={methods.control}
        name="name"
        rules={{ required: "Required" }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <input {...field} />
            </FormControl>
            <FormDescription>Enter a name.</FormDescription>
            <FormMessage>Fallback</FormMessage>
          </FormItem>
        )}
      />
      <button type="button" onClick={() => void methods.trigger("name")}>
        Validate
      </button>
    </Form>
  );
}

describe("form wrappers", () => {
  it("renders labels, controls, descriptions, and validation messages", async () => {
    render(<FormFixture />);
    expect(screen.getByText("Fallback")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Validate" }));
    expect(await screen.findByText("Required")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });

  it("rejects form helpers outside their required contexts", () => {
    function InvalidField() {
      useFormField();
      return null;
    }
    function ContextOnly() {
      const methods = useForm();
      return (
        <Form {...methods}>
          <InvalidField />
        </Form>
      );
    }
    expect(() => render(<ContextOnly />)).toThrow("useFormField should be used within <FormField>");
  });
});
