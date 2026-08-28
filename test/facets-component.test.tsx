import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { FacetGroup } from "../src/components/Facets";

afterEach(cleanup);

function InteractiveFacetGroup() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  return (
    <FacetGroup
      title="Task"
      options={[
        { value: "one", label: "One", count: 3 },
        { value: "two", label: "Two", count: 2 },
        { value: "three", label: "Three", count: 1 },
      ]}
      selected={selected}
      onToggle={(value) =>
        setSelected((current) => {
          const next = new Set(current);
          if (next.has(value)) next.delete(value);
          else next.add(value);
          return next;
        })
      }
      limit={1}
    />
  );
}

describe("FacetGroup disclosure", () => {
  it("keeps long facet lists compact and searchable", () => {
    render(<InteractiveFacetGroup />);

    const trigger = screen.getByRole("button", { name: "Filter by Task" });
    expect(screen.getByText("3 options")).toBeInTheDocument();

    fireEvent.click(trigger);

    expect(screen.getByPlaceholderText("Search task…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "One (3)" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Three (1)" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search task…"), {
      target: { value: "three" },
    });
    expect(screen.getByRole("button", { name: "Three (1)" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Three (1)" }));
    expect(trigger).toHaveTextContent("1 selected");
  });
});
