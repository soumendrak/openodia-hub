import { render, screen } from "@testing-library/react";
import { OTPInputContext } from "input-otp";
import type React from "react";
import { describe, expect, it } from "vitest";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../src/components/ui/alert-dialog";
import { Calendar } from "../src/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "../src/components/ui/command";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../src/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "../src/components/ui/drawer";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../src/components/ui/hover-card";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "../src/components/ui/input-otp";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuViewport,
} from "../src/components/ui/navigation-menu";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "../src/components/ui/resizable";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../src/components/ui/sheet";
import { Toaster } from "../src/components/ui/sonner";

describe("overlay and composite UI wrappers", () => {
  it("renders alert, dialog, sheet, drawer, and hover-card surfaces", () => {
    render(
      <>
        <AlertDialog defaultOpen>
          <AlertDialogTrigger>Alert trigger</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Alert title</AlertDialogTitle>
              <AlertDialogDescription>Alert description</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction>Continue</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Dialog defaultOpen>
          <DialogTrigger>Dialog trigger</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dialog title</DialogTitle>
              <DialogDescription>Dialog description</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose>Close</DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Sheet defaultOpen>
          <SheetTrigger>Sheet trigger</SheetTrigger>
          <SheetContent side="left">
            <SheetHeader>
              <SheetTitle>Sheet title</SheetTitle>
              <SheetDescription>Sheet description</SheetDescription>
            </SheetHeader>
            <SheetFooter>
              <SheetClose>Done</SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
        <Drawer defaultOpen>
          <DrawerTrigger>Drawer trigger</DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Drawer title</DrawerTitle>
              <DrawerDescription>Drawer description</DrawerDescription>
            </DrawerHeader>
            <DrawerFooter>
              <DrawerClose>Dismiss</DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
        <HoverCard defaultOpen>
          <HoverCardTrigger>Hover target</HoverCardTrigger>
          <HoverCardContent>Hover details</HoverCardContent>
        </HoverCard>
      </>,
    );
    expect(screen.getByText("Alert title")).toBeInTheDocument();
    expect(screen.getByText("Dialog title")).toBeInTheDocument();
    expect(screen.getByText("Sheet title")).toBeInTheDocument();
    expect(screen.getByText("Drawer title")).toBeInTheDocument();
    expect(screen.getByText("Hover details")).toBeInTheDocument();
  });

  it("renders command, OTP, navigation, resizable, calendar, and toast composites", () => {
    render(
      <>
        <Command>
          <CommandInput placeholder="Search" />
          <CommandList>
            <CommandEmpty>Nothing</CommandEmpty>
            <CommandGroup heading="Group">
              <CommandItem>
                Choice<CommandShortcut>⌘K</CommandShortcut>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
          </CommandList>
        </Command>
        <InputOTP maxLength={2}>
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSeparator />
            <InputOTPSlot index={1} />
          </InputOTPGroup>
        </InputOTP>
        <NavigationMenu defaultValue="one">
          <NavigationMenuList>
            <NavigationMenuItem value="one">
              <NavigationMenuTrigger>Learn</NavigationMenuTrigger>
              <NavigationMenuContent>
                <NavigationMenuLink href="#docs">Docs</NavigationMenuLink>
              </NavigationMenuContent>
            </NavigationMenuItem>
          </NavigationMenuList>
          <NavigationMenuIndicator />
          <NavigationMenuViewport />
        </NavigationMenu>
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel defaultSize={50}>Left</ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={50}>Right</ResizablePanel>
        </ResizablePanelGroup>
        <Calendar month={new Date(2026, 8, 1)} showWeekNumber captionLayout="dropdown" />
        <Toaster position="top-center" />
      </>,
    );
    expect(screen.getByPlaceholderText("Search")).toBeInTheDocument();
    expect(screen.getByText("Choice")).toBeInTheDocument();
    expect(screen.getByText("September 2026")).toBeInTheDocument();
  });

  it("renders an active OTP slot with its fake caret", () => {
    const { container } = render(
      <OTPInputContext.Provider
        value={
          { slots: [{ char: "1", hasFakeCaret: true, isActive: true }] } as React.ContextType<
            typeof OTPInputContext
          >
        }
      >
        <InputOTPSlot index={0} />
      </OTPInputContext.Provider>,
    );
    const slot = container.firstElementChild as HTMLElement;
    expect(slot).toHaveClass("ring-1", "ring-ring");
    expect(container.querySelector(".animate-caret-blink")).toBeInTheDocument();
  });
});
