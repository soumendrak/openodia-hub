import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Reveal } from "../src/components/Reveal";

afterEach(cleanup);

/**
 * Reveal's entrance is CSS, so what is worth pinning down is the delay
 * ceiling: several call sites pass an index-derived delay, and without the cap
 * a long grid puts its last card most of a second behind its first — the
 * "loaded fast, feels slow" failure this component was rewritten to fix.
 */
describe("Reveal", () => {
  const block = (props: { delay?: number }) =>
    render(<Reveal {...props}>content</Reveal>).container.firstElementChild as HTMLElement;

  it("animates on mount rather than waiting to be scrolled into view", () => {
    expect(block({}).className).toContain("anim-in");
  });

  it("applies no delay when none is asked for", () => {
    expect(block({}).style.animationDelay).toBe("");
  });

  it("passes a small delay through untouched", () => {
    expect(block({ delay: 0.1 }).style.animationDelay).toBe("0.1s");
  });

  it("caps a delay that would leave the element visibly late", () => {
    // i * 0.08 on the twelfth card in a grid — 0.96s uncapped.
    expect(block({ delay: 0.96 }).style.animationDelay).toBe("0.15s");
  });

  it("keeps caller classes and props", () => {
    const el = block({}) as HTMLElement;
    expect(el.tagName).toBe("DIV");
    const withClass = render(
      <Reveal className="mt-12" data-testid="x">
        content
      </Reveal>,
    ).container.firstElementChild as HTMLElement;
    expect(withClass.className).toContain("mt-12");
    expect(withClass.className).toContain("anim-in");
    expect(withClass.getAttribute("data-testid")).toBe("x");
  });
});
