import { describe, it, expect } from "vitest";
import { cn, mergeNonEmpty } from "../src/lib/utils";

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

describe("mergeNonEmpty", () => {
  it("keeps curated values when the incoming row is blank", () => {
    const curated = { url: "u", location: "NIT Rourkela", description: "Hand-written blurb" };
    const scraped = { url: "u", location: undefined, description: "" };
    expect(mergeNonEmpty(curated, scraped)).toEqual(curated);
  });

  it("still takes real incoming values", () => {
    expect(mergeNonEmpty({ title: "old", location: "A" }, { title: "new" })).toEqual({
      title: "new",
      location: "A",
    });
  });

  it("skips nulls", () => {
    expect(mergeNonEmpty({ a: 1 }, { a: null as unknown as number })).toEqual({ a: 1 });
  });
});
