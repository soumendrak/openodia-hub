import { describe, expect, it } from "vitest";
import { createRouter } from "@tanstack/react-router";

import { routeTree } from "../src/routeTree.gen";

describe("generated route tree", () => {
  it("contains the generated root and public child route registrations", () => {
    expect(routeTree).toBeDefined();
    expect(routeTree.options).toBeDefined();
    const router = createRouter({ routeTree, context: { queryClient: undefined as never } });
    expect(router.routesById["/"]).toBeDefined();
    for (const route of Object.values(router.routesById)) {
      if (route.options.getParentRoute) expect(route.options.getParentRoute()).toBe(routeTree);
    }
  });
});
