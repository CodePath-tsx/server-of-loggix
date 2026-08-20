import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

import { useMBStore } from "@/lib/mb-store";
import "@/i18n";
import { initTheme } from "@/lib/theme";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Page non trouvée</p>
        <a href="/" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Retour à l'accueil
        </a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Une erreur est survenue</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Réessayer
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "LogixStore — Point of Sale & Business Management" },
      { name: "description", content: "Offline ERP and Point of Sale for retail, wholesale, and service businesses. Manage products, stock, sales, customers, and reports." },
      { property: "og:title", content: "LogixStore — Point of Sale & Business Management" },
      { property: "og:description", content: "Offline ERP and POS system with inventory, sales, reports, and multi-user access control." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  // In the Electron SPA build, index.html already provides <html>/<head>/<body>.
  // Rendering RootShell would nest a second <html> inside #root AND <Scripts />
  // would re-inject the JS bundle — creating two copies of React in memory.
  // Duplicate React breaks react-hook-form: inputs render but event handlers
  // are never attached, so typing is silently ignored.
  // VITE_IS_ELECTRON is set to "true" only by vite.electron.config.ts.
  if (import.meta.env.VITE_IS_ELECTRON === "true") {
    return <>{children}</>;
  }

  // SSR (browser) path — suppressHydrationWarning because the server always
  // renders lang="fr" dir="ltr" but the client immediately reads localStorage
  // and updates the attributes. The mismatch is intentional and harmless.
  return (
    <html lang="fr" dir="ltr" suppressHydrationWarning>
      <head><HeadContent /></head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const theme = useMBStore((s) => s.settings.theme);

  useEffect(() => {
    initTheme();
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (theme === "dark" || theme === "light") {
      document.documentElement.classList.toggle("dark", theme === "dark");
    }
  }, [theme]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
