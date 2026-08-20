import { QueryClient } from "@tanstack/react-query";
import { createRouter, createHashHistory } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  // In Electron (file:// protocol), hash-based routing is required.
  // In the browser, undefined = default browser history (real URLs).
  const history =
    typeof window !== "undefined" && (window as any).electronAPI?.isElectron
      ? createHashHistory()
      : undefined;

  const router = createRouter({
    routeTree,
    context: { queryClient },
    history,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
