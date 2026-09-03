import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "../src/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../src/components/ui/dropdown-menu";
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "../src/components/ui/menubar";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "../src/components/ui/select";

describe("menu UI wrappers", () => {
  it("renders context and dropdown menu item variants", () => {
    const context = render(
      <ContextMenu>
        <ContextMenuTrigger>Context target</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuLabel inset>Context label</ContextMenuLabel>
          <ContextMenuGroup>
            <ContextMenuItem inset>
              Context item<ContextMenuShortcut>⌘C</ContextMenuShortcut>
            </ContextMenuItem>
          </ContextMenuGroup>
          <ContextMenuCheckboxItem checked>Context check</ContextMenuCheckboxItem>
          <ContextMenuRadioGroup value="a">
            <ContextMenuRadioItem value="a">Context radio</ContextMenuRadioItem>
          </ContextMenuRadioGroup>
          <ContextMenuSeparator />
          <ContextMenuSub open>
            <ContextMenuSubTrigger inset>Context more</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem>Context nested</ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        </ContextMenuContent>
      </ContextMenu>,
    );
    fireEvent.contextMenu(screen.getByText("Context target"));
    expect(screen.getByText("Context item")).toBeInTheDocument();
    expect(screen.getByText("Context nested")).toBeInTheDocument();
    context.unmount();

    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Dropdown trigger</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel inset>Dropdown label</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem inset>
              Dropdown item<DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuCheckboxItem checked>Dropdown check</DropdownMenuCheckboxItem>
          <DropdownMenuRadioGroup value="a">
            <DropdownMenuRadioItem value="a">Dropdown radio</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuSub open>
            <DropdownMenuSubTrigger inset>Dropdown more</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Dropdown nested</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    expect(screen.getByText("Dropdown item")).toBeInTheDocument();
    expect(screen.getByText("Dropdown nested")).toBeInTheDocument();
  });

  it("renders menubar and select variants", () => {
    render(
      <>
        <Menubar value="file">
          <MenubarMenu value="file">
            <MenubarTrigger>File</MenubarTrigger>
            <MenubarContent forceMount>
              <MenubarLabel inset>Actions</MenubarLabel>
              <MenubarGroup>
                <MenubarItem inset>
                  Open<MenubarShortcut>⌘O</MenubarShortcut>
                </MenubarItem>
              </MenubarGroup>
              <MenubarCheckboxItem checked>Autosave</MenubarCheckboxItem>
              <MenubarRadioGroup value="one">
                <MenubarRadioItem value="one">One</MenubarRadioItem>
              </MenubarRadioGroup>
              <MenubarSeparator />
              <MenubarSub open>
                <MenubarSubTrigger inset>More</MenubarSubTrigger>
                <MenubarSubContent>
                  <MenubarItem>Nested</MenubarItem>
                </MenubarSubContent>
              </MenubarSub>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
        <Select defaultOpen defaultValue="one">
          <SelectTrigger>
            <SelectValue placeholder="Choose" />
          </SelectTrigger>
          <SelectContent>
            <SelectScrollUpButton />
            <SelectGroup>
              <SelectLabel>Options</SelectLabel>
              <SelectItem value="one">First option</SelectItem>
              <SelectItem value="two">Second option</SelectItem>
            </SelectGroup>
            <SelectSeparator />
            <SelectScrollDownButton />
          </SelectContent>
        </Select>
      </>,
    );
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getAllByText("First option")).toHaveLength(2);
  });
});
