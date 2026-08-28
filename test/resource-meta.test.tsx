import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ResourceMeta } from "../src/components/ResourceMeta";

/**
 * A closed <details> hides its contents visually but still ships, parses and
 * hydrates them. On /tools that meant 30 cards each carrying two copy buttons,
 * two inline SVGs and two citation blobs — 58% of the page's markup, for a
 * panel almost nobody opens.
 *
 * Deferring the body is invisible when it works and invisible when it breaks:
 * dropping the `open &&` guard restores the old weight and every visible
 * behaviour stays identical. Hence the assertion on absence.
 */
const entry = {
  name: "Sua",
  author: "soumendrak",
  url: "https://github.com/soumendrak/sua",
  createdAt: "2024-01-01T00:00:00Z",
};

afterEach(cleanup);

describe("ResourceMeta", () => {
  it("renders the summary without the citation body", () => {
    render(<ResourceMeta license="MIT" entry={entry} />);
    // The license and the Cite affordance are the whole closed-state cost.
    expect(screen.getByText("MIT")).toBeInTheDocument();
    expect(screen.getByText("Cite")).toBeInTheDocument();
    expect(screen.queryByText("BibTeX")).not.toBeInTheDocument();
    expect(screen.queryByText("APA")).not.toBeInTheDocument();
    expect(document.querySelector("pre")).toBeNull();
  });

  it("renders the citations once the disclosure is opened", async () => {
    const { container } = render(<ResourceMeta license="MIT" entry={entry} />);
    const details = container.querySelector("details") as HTMLDetailsElement;

    details.open = true;
    details.dispatchEvent(new Event("toggle"));

    expect(await screen.findByText("BibTeX")).toBeInTheDocument();
    expect(screen.getByText("APA")).toBeInTheDocument();
    expect(container.textContent).toContain("@misc{soumendrak_sua");
  });
});
