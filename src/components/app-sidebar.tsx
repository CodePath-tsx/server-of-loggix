import { Link, useRouterState } from "@tanstack/react-router";
import {
  ShoppingCart, FileText, Package, Tag, Database, ArrowLeftRight,
  Receipt, Users, Truck, BarChart3, UserCog, Settings, KeyRound, LogOut, Store,
  LayoutDashboard, Wifi,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { logout, useSession, hasPermission, type Permission } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface Item {
  to: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  perm: Permission;
}

const items: Item[] = [
  { to: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard, perm: "reports.view" },
  { to: "/pos", labelKey: "nav.pos", icon: ShoppingCart, perm: "pos.use" },
  { to: "/sales", labelKey: "nav.sales", icon: FileText, perm: "sales.view" },
  { to: "/products", labelKey: "nav.products", icon: Package, perm: "products.manage" },
  { to: "/categories", labelKey: "nav.categories", icon: Tag, perm: "categories.manage" },
  { to: "/stock", labelKey: "nav.stock", icon: Database, perm: "stock.manage" },
  { to: "/stock-movement", labelKey: "nav.movements", icon: ArrowLeftRight, perm: "movements.view" },
  { to: "/expenses", labelKey: "nav.expenses", icon: Receipt, perm: "expenses.manage" },
  { to: "/customers", labelKey: "nav.customers", icon: Users, perm: "customers.manage" },
  { to: "/suppliers", labelKey: "nav.suppliers", icon: Truck, perm: "suppliers.manage" },
  { to: "/reports", labelKey: "nav.reports", icon: BarChart3, perm: "reports.view" },
  { to: "/users", labelKey: "nav.users", icon: UserCog, perm: "users.manage" },
  { to: "/settings", labelKey: "nav.settings", icon: Settings, perm: "settings.manage" },
  { to: "/license", labelKey: "nav.license", icon: KeyRound, perm: "license.manage" },
  { to: "/sync", labelKey: "nav.sync", icon: Wifi, perm: "settings.manage" },
];

interface Props { onNavigate?: () => void }

export function AppSidebar({ onNavigate }: Props = {}) {
  const session = useSession();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { t } = useTranslation();

  const initials = (session?.displayName ?? "?").split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase();

  return (
    <aside className={cn(
      "flex w-64 md:w-64 h-full md:h-screen shrink-0 flex-col bg-sidebar text-sidebar-foreground",
      "border-r",
    )}>
      <div className="flex items-center gap-2 px-6 py-5 border-b">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Store className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-base font-extrabold tracking-tight text-primary truncate">{t("app.name")}</p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("app.tagline")}</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {items.map((it) => {
          if (!hasPermission(session?.role, it.perm)) return null;
          const active = pathname === it.to || (it.to === "/pos" && pathname === "/");
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{t(it.labelKey)}</span>
            </Link>
          );
        })}
      </nav>

      {session && (
        <div className="border-t p-3">
          <div className="flex items-center gap-3 rounded-xl bg-sidebar-accent px-3 py-2.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate">{session.displayName}</p>
              <p className="text-[10px] text-muted-foreground capitalize truncate">{session.role}</p>
            </div>
            <button
              onClick={() => { logout(); window.location.href = "/login"; }}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-background hover:text-destructive"
              aria-label={t("actions.logout")}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
