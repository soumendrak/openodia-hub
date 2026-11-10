import type { ComponentType } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assessLocale } from "../src/lib/locale-status";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("translation status search", () => {
  it("matches English and keys regardless of Turkish default casing, while preserving Odia", async () => {
    const locale = await import("../src/lib/locale-status");
    vi.spyOn(locale, "getLocaleStatus").mockReturnValue(
      assessLocale(
        { "status.inventory": "Inspect UI strings", other: "Home" },
        { "status.inventory": "ଅନୁବାଦ ତାଲିକା", other: "ମୂଳପୃଷ୍ଠା" },
        ["status.inventory", "other"],
        {},
      ),
    );
    const localeLowerCase = String.prototype.toLocaleLowerCase;
    vi.spyOn(String.prototype, "toLocaleLowerCase").mockImplementation(function (
      this: string,
      locales?: string | string[],
    ) {
      return localeLowerCase.call(this, locales ?? "tr");
    });
    const { Route } = await import("../src/routes/translation-status");
    const Page = (Route as unknown as { options: { component: ComponentType } }).options.component;
    render(<Page />);

    for (const query of ["inspect", "STATUS.INVENTORY", "ଅନୁବାଦ"]) {
      fireEvent.change(screen.getByRole("searchbox"), { target: { value: query } });
      expect(screen.getByText("1 strings shown")).toBeInTheDocument();
      expect(screen.getByText("Inspect UI strings")).toBeInTheDocument();
      expect(screen.getByText("ଅନୁବାଦ ତାଲିକା")).toHaveAttribute("lang", "or");
    }
  });
});
