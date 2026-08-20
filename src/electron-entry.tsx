/**
 * Electron SPA entry point.
 * Used ONLY by vite.electron.config.ts — the SSR (browser) build uses TanStack Start.
 * This bootstraps the React app directly without any server-side rendering.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
// i18n is initialised inside __root.tsx (import "@/i18n") — do NOT import it
// here again or two conflicting i18next instances get bundled together.
import "./styles.css";

const router = getRouter();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
