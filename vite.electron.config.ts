/**
 * Vite config for the Electron production build (SPA, no SSR).
 * Output goes to dist/ which Electron's main.cjs loads as file://dist/index.html.
 *
 * Usage:
 *   npm run electron:build   →  vite build --config vite.electron.config.ts
 *
 * Key differences from the browser (SSR) config:
 *  - base: "./"  — Electron loads files from disk (file://), assets must be relative
 *  - No nitro/server — pure SPA
 *  - Entry: index.html → src/electron-entry.tsx (bypasses TanStack Start SSR shell)
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "path";

export default defineConfig({
  plugins: [
    // Generate routeTree.gen.ts from file-based routes
    TanStackRouterVite({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],

  // base: "./" is critical — Electron loads the file from disk (file://)
  // and all asset paths must be relative, not absolute (/assets/...).
  base: "./",

  // Resolve @ alias explicitly so it works even without tsconfig resolution.
  // dedupe ensures only ONE copy of React/Router ends up in the bundle —
  // duplicate copies cause "Invalid hook call" and break form event handlers.
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "@tanstack/react-router",
      "@tanstack/react-query",
    ],
  },

  // Inject a build-time constant so __root.tsx can skip the SSR HTML shell
  // (RootShell + Scripts) which would re-inject the JS bundle and duplicate React.
  define: {
    "import.meta.env.VITE_IS_ELECTRON": JSON.stringify("true"),
  },

  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "index.html"),
    },
  },
});
