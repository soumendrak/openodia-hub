import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Start the route's loader on hover/touch rather than on click. The
    // catalog loaders are server round-trips, so the ~300ms a pointer spends
    // travelling to a nav item is enough to have the data in hand by the time
    // it lands — the difference between a tab that opens and a tab that waits.
    defaultPreload: "intent",
    // Was 0, which made every preload a guaranteed refetch and threw away the
    // work on arrival. The route data is upstream-cached with its own TTL, so
    // a couple of minutes of reuse across a session is free.
    defaultPreloadStaleTime: 2 * 60 * 1000,
  });

  return router;
};
