import { describe, it, expect } from "vitest";
import { cn } from "../src/lib/utils";

describe("cn", () => {
  it("merges classes", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });

  it("handles conditional classes", () => {
    const hidden: string | false = false;
    expect(cn("base", hidden && "hidden", undefined, null, "active")).toBe("base active");
  });

  it("resolves tailwind conflicts", () => {
    expect(cn("px-4", "px-6")).toBe("px-6");
  });
});
