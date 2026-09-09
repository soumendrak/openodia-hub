import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../src/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "../src/components/ui/alert";
import { AspectRatio } from "../src/components/ui/aspect-ratio";
import { Avatar, AvatarFallback, AvatarImage } from "../src/components/ui/avatar";
import { Badge, badgeVariants } from "../src/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../src/components/ui/breadcrumb";
import { Button, buttonVariants } from "../src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../src/components/ui/card";
import { Checkbox } from "../src/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../src/components/ui/collapsible";
import { Input } from "../src/components/ui/input";
import { Label } from "../src/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../src/components/ui/pagination";
import { Progress } from "../src/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "../src/components/ui/radio-group";
import { ScrollArea, ScrollBar } from "../src/components/ui/scroll-area";
import { Separator } from "../src/components/ui/separator";
import { Skeleton } from "../src/components/ui/skeleton";
import { Slider } from "../src/components/ui/slider";
import { Switch } from "../src/components/ui/switch";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "../src/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../src/components/ui/tabs";
import { Textarea } from "../src/components/ui/textarea";
import { Toggle, toggleVariants } from "../src/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "../src/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../src/components/ui/tooltip";

describe("UI primitive wrappers", () => {
  it("renders structural and form primitives with their supported variants", () => {
    render(
      <div>
        <Alert variant="destructive">
          <AlertTitle>Alert title</AlertTitle>
          <AlertDescription>Alert body</AlertDescription>
        </Alert>
        <AspectRatio ratio={2}>
          <span>ratio</span>
        </AspectRatio>
        <Avatar>
          <AvatarImage src="avatar.png" />
          <AvatarFallback>AA</AvatarFallback>
        </Avatar>
        <Badge variant="secondary">Badge</Badge>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <a href="/via-slot">Via Slot</a>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Page</BreadcrumbPage>
            </BreadcrumbItem>
            <BreadcrumbEllipsis />
          </BreadcrumbList>
        </Breadcrumb>
        <Button variant="outline" size="sm">
          Button
        </Button>
        <Button asChild>
          <a href="/via-slot-button">Slot button</a>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Card title</CardTitle>
            <CardDescription>Description</CardDescription>
          </CardHeader>
          <CardContent>Content</CardContent>
          <CardFooter>Footer</CardFooter>
        </Card>
        <label>
          <Checkbox defaultChecked /> Check
        </label>
        <Collapsible defaultOpen>
          <CollapsibleTrigger>Open</CollapsibleTrigger>
          <CollapsibleContent>Inside</CollapsibleContent>
        </Collapsible>
        <Input aria-label="input" />
        <Label>Label</Label>
        <Progress value={50} />
        <Progress aria-label="no value" />
        <RadioGroup defaultValue="one">
          <RadioGroupItem value="one" />
        </RadioGroup>
        <ScrollArea className="h-10">
          <span>Scrollable</span>
          <ScrollBar />
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        <Separator />
        <Separator orientation="vertical" />
        <Skeleton>Loading</Skeleton>
        <Slider defaultValue={[25]} max={100} />
        <Switch defaultChecked />
        <Table>
          <TableCaption>Caption</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Heading</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Cell</TableCell>
            </TableRow>
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>Total</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
        <Tabs defaultValue="one">
          <TabsList>
            <TabsTrigger value="one">One</TabsTrigger>
            <TabsTrigger value="two">Two</TabsTrigger>
          </TabsList>
          <TabsContent value="one">First</TabsContent>
          <TabsContent value="two">Second</TabsContent>
        </Tabs>
        <Textarea aria-label="textarea" />
        <Toggle variant="outline" size="sm">
          Toggle
        </Toggle>
        <ToggleGroup type="single" defaultValue="a">
          <ToggleGroupItem value="a">A</ToggleGroupItem>
          <ToggleGroupItem value="b" variant="outline" size="sm">
            B
          </ToggleGroupItem>
        </ToggleGroup>
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="#prev" />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#1" isActive>
                1
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext href="#next" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
        <TooltipProvider>
          <Tooltip defaultOpen>
            <TooltipTrigger>Hover</TooltipTrigger>
            <TooltipContent side="bottom">Tip</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>,
    );

    expect(screen.getByText("Alert title")).toBeInTheDocument();
    expect(screen.getByText("Card title")).toBeInTheDocument();
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(badgeVariants({ variant: "outline" })).toContain("border");
    expect(buttonVariants({ variant: "ghost", size: "icon" })).toContain("hover:bg-accent");
    expect(toggleVariants({ variant: "default", size: "lg" })).toContain("h-10");

    // BreadcrumbLink asChild: Slot merges its child's own <a> instead of
    // wrapping it in another element.
    const slotLink = screen.getByText("Via Slot");
    expect(slotLink.tagName).toBe("A");
    expect(slotLink).toHaveAttribute("href", "/via-slot");
    expect(slotLink).toHaveClass("transition-colors");

    // Button asChild: Slot merges its child's own <a> instead of wrapping it
    // in a <button>, while still applying the button's variant classes.
    const slotButton = screen.getByText("Slot button");
    expect(slotButton.tagName).toBe("A");
    expect(slotButton).toHaveAttribute("href", "/via-slot-button");
    expect(slotButton).toHaveClass("bg-primary");

    // Progress without a `value` prop exercises the `value || 0` fallback.
    const noValueIndicator = screen.getByRole("progressbar", { name: "no value" })
      .firstElementChild as HTMLElement;
    expect(noValueIndicator).toHaveStyle({ transform: "translateX(-100%)" });
  });

  it("renders accordion content after its trigger is activated", () => {
    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="one">
          <AccordionTrigger>Question</AccordionTrigger>
          <AccordionContent>Answer</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Question" }));
    expect(screen.getByText("Answer")).toBeInTheDocument();
  });
});
