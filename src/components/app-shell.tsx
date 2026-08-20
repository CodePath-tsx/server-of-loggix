import { useState, useEffect, type ReactNode } from "react";
import { Menu, Sun, Moon, Monitor } from "lucide-react";
import { AppSidebar } from "./app-sidebar";
import { NotificationCenter } from "./notification-center";
import { applyTheme, getStoredTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

interface Props { children: ReactNode }

export function AppShell({ children }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  // Use "auto" as the SSR-safe default; update to the actual stored value on
  // the client after hydration so the server and client HTML match.
  const [theme, setTheme] = useState<Theme>("auto");
  useEffect(() => { setTheme(getStoredTheme()); }, []);

  const cycleTheme = () => {
    const order: Theme[] = ["light", "dark", "auto"];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
    applyTheme(next);
  };

  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;


  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <AppSidebar />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className={cn(
              "absolute top-0 bottom-0 w-72 bg-sidebar shadow-2xl",
              "left-0",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <AppSidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex flex-1 min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card/80 backdrop-blur px-3 md:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-xl border md:hidden hover:bg-accent"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />


          <button
            onClick={cycleTheme}
            className="grid h-10 w-10 place-items-center rounded-xl border bg-card hover:bg-accent"
            aria-label="Theme"
          >
            <ThemeIcon className="h-4 w-4" />
          </button>
          <NotificationCenter />
        </header>
        <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}

interface PageHeaderProps { title: string; description?: string; actions?: ReactNode }

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function PageBody({ children }: { children: ReactNode }) {
  return <div className="p-3 md:p-8 space-y-6">{children}</div>;
}
