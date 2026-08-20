import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  TrendingUp, Package, Users, DollarSign, AlertTriangle,
  ShoppingCart, ArrowUpRight, ArrowDownRight, BarChart3,
} from "lucide-react";
import { useMBStore, formatMoney } from "@/lib/mb-store";
import { PageBody, PageHeader } from "@/components/app-shell";
import { useTranslation } from "react-i18next";
import { useAuthStore, hasPermission } from "@/lib/auth";

export const Route = createFileRoute("/_app/dashboard")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const session = useAuthStore.getState().session;
    if (!hasPermission(session?.role, "reports.view")) {
      throw redirect({ to: "/pos" });
    }
  },
  component: DashboardPage,
});

const COLORS = ["#1e3a5f", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

/* ─── Date helpers ─── */
const startOf = (unit: "day" | "week" | "month") => {
  const d = new Date();
  if (unit === "day") { d.setHours(0, 0, 0, 0); return d; }
  if (unit === "week") return new Date(Date.now() - 7 * 86400000);
  d.setDate(1); d.setHours(0, 0, 0, 0); return d;
};
const fmt = (d: Date) => d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

function DashboardPage() {
  const { t } = useTranslation();
  const sales      = useMBStore((s) => s.sales);
  const products   = useMBStore((s) => s.products);
  const expenses   = useMBStore((s) => s.expenses);
  const customers  = useMBStore((s) => s.customers);
  const currency   = useMBStore((s) => s.settings.currency);
  const company    = useMBStore((s) => s.settings.name);

  const stats = useMemo(() => {
    const todayStart = startOf("day");
    const monthStart = startOf("month");
    const weekStart  = startOf("week");

    const todaySales = sales.filter(
      (s) => s.status === "completed" && new Date(s.createdAt) >= todayStart,
    );
    const monthSales = sales.filter(
      (s) => s.status === "completed" && new Date(s.createdAt) >= monthStart,
    );
    const prevMonthStart = new Date(monthStart);
    prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
    const prevMonthSales = sales.filter(
      (s) =>
        s.status === "completed" &&
        new Date(s.createdAt) >= prevMonthStart &&
        new Date(s.createdAt) < monthStart,
    );

    const monthRev     = monthSales.reduce((a, s) => a + s.total, 0);
    const prevMonthRev = prevMonthSales.reduce((a, s) => a + s.total, 0);
    const revChange    = prevMonthRev > 0 ? ((monthRev - prevMonthRev) / prevMonthRev) * 100 : 0;

    const monthExp  = expenses
      .filter((e) => new Date(e.createdAt) >= monthStart)
      .reduce((a, e) => a + e.amount, 0);
    const stockVal  = products.reduce((a, p) => a + p.cost * p.stock, 0);
    const lowStock  = products.filter((p) => p.stock <= p.minStock && p.active);
    const totalDebt = customers.reduce((a, c) => a + (c.balance > 0 ? c.balance : 0), 0);

    // Last 7 days — one point per day
    const days7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const rev = sales
        .filter((s) => s.status === "completed" && new Date(s.createdAt) >= d && new Date(s.createdAt) < next)
        .reduce((a, s) => a + s.total, 0);
      const exp = expenses
        .filter((e) => new Date(e.createdAt) >= d && new Date(e.createdAt) < next)
        .reduce((a, e) => a + e.amount, 0);
      return { name: fmt(d), revenue: +rev.toFixed(0), expenses: +exp.toFixed(0) };
    });

    // Top 5 products by qty sold this month
    const qtyMap: Record<string, { name: string; qty: number; revenue: number }> = {};
    monthSales.forEach((s) =>
      s.items.forEach((it) => {
        if (!qtyMap[it.productId]) qtyMap[it.productId] = { name: it.name, qty: 0, revenue: 0 };
        qtyMap[it.productId].qty += it.quantity;
        qtyMap[it.productId].revenue += it.subtotal;
      }),
    );
    const top5 = Object.values(qtyMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((x) => ({ name: x.name.slice(0, 16), qty: x.qty, revenue: +x.revenue.toFixed(0) }));

    // Payment methods this month
    const payMap: Record<string, number> = {};
    monthSales.forEach((s) => { payMap[s.payment] = (payMap[s.payment] ?? 0) + s.total; });
    const payData = Object.entries(payMap).map(([name, value]) => ({
      name,
      value: +value.toFixed(0),
    }));

    const recentSales = sales
      .filter((s) => s.status === "completed")
      .slice(0, 8);

    return {
      todayRev: todaySales.reduce((a, s) => a + s.total, 0),
      todayCount: todaySales.length,
      monthRev,
      revChange,
      monthExp,
      profit: monthRev - monthExp,
      stockVal,
      lowStock,
      totalDebt,
      days7,
      top5,
      payData,
      recentSales,
    };
  }, [sales, products, expenses, customers]);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <PageBody>
      <PageHeader
        title={`${greeting}, ${company} 👋`}
        description={t("nav.dashboard") + " — " + new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
      />

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Chiffre d'affaires (mois)"
          value={formatMoney(stats.monthRev, currency)}
          sub={stats.revChange >= 0 ? `+${stats.revChange.toFixed(1)}% vs mois dernier` : `${stats.revChange.toFixed(1)}% vs mois dernier`}
          Icon={TrendingUp}
          color="text-primary"
          trend={stats.revChange >= 0 ? "up" : "down"}
        />
        <KpiCard
          label="Aujourd'hui"
          value={formatMoney(stats.todayRev, currency)}
          sub={`${stats.todayCount} transaction${stats.todayCount !== 1 ? "s" : ""}`}
          Icon={ShoppingCart}
          color="text-success"
        />
        <KpiCard
          label="Bénéfice (mois)"
          value={formatMoney(stats.profit, currency)}
          sub={`Dépenses: ${formatMoney(stats.monthExp, currency)}`}
          Icon={BarChart3}
          color={stats.profit >= 0 ? "text-success" : "text-destructive"}
        />
        <KpiCard
          label="Valeur du stock"
          value={formatMoney(stats.stockVal, currency)}
          sub={`${stats.lowStock.length} article(s) en rupture`}
          Icon={Package}
          color="text-info"
          alert={stats.lowStock.length > 0}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sales trend — 7 days */}
        <div className="lg:col-span-2 rounded-2xl border bg-card p-5 shadow-card">
          <h3 className="mb-4 font-bold text-sm">Ventes & dépenses — 7 derniers jours</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={stats.days7} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1e3a5f" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#1e3a5f" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={60}
                tickFormatter={(v) => v === 0 ? "0" : `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 10, border: "1px solid #e2e8f0" }}
                formatter={(v: number) => [formatMoney(v, currency), ""]}
              />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="revenue" name="Ventes" stroke="#1e3a5f" strokeWidth={2} fill="url(#revGrad)" />
              <Area type="monotone" dataKey="expenses" name="Dépenses" stroke="#ef4444" strokeWidth={2} fill="url(#expGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Payment methods pie */}
        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <h3 className="mb-4 font-bold text-sm">Mode de paiement (mois)</h3>
          {stats.payData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={stats.payData}
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {stats.payData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 10 }}
                  formatter={(v: number) => [formatMoney(v, currency), ""]}
                />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-[220px] place-items-center text-sm text-muted-foreground">
              Aucune vente ce mois
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Top products bar chart */}
        <div className="lg:col-span-2 rounded-2xl border bg-card p-5 shadow-card">
          <h3 className="mb-4 font-bold text-sm">Top 5 produits — CA ce mois</h3>
          {stats.top5.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.top5} layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
                <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={90} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 10 }}
                  formatter={(v: number) => [formatMoney(v, currency), "CA"]}
                />
                <Bar dataKey="revenue" fill="#1e3a5f" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-[200px] place-items-center text-sm text-muted-foreground">
              Aucune vente ce mois
            </div>
          )}
        </div>

        {/* Low stock alerts */}
        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold text-sm">Alertes stock bas</h3>
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
              stats.lowStock.length > 0 ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
            }`}>
              {stats.lowStock.length}
            </span>
          </div>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {stats.lowStock.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">✅ Tous les stocks sont OK</p>
            ) : (
              stats.lowStock.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl border px-3 py-2">
                  <div>
                    <p className="text-xs font-semibold truncate max-w-[130px]">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">Min: {p.minStock}</p>
                  </div>
                  <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${
                    p.stock <= 0 ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"
                  }`}>
                    {p.stock <= 0 ? "Rupture" : p.stock}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent sales + debt */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border bg-card p-5 shadow-card">
          <h3 className="mb-3 font-bold text-sm">Dernières ventes</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="pb-2 text-start font-medium">Facture</th>
                  <th className="pb-2 text-start font-medium">Date</th>
                  <th className="pb-2 text-start font-medium">Client</th>
                  <th className="pb-2 text-end font-medium">Total</th>
                  <th className="pb-2 text-end font-medium">Mode</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {stats.recentSales.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">Aucune vente</td></tr>
                ) : (
                  stats.recentSales.map((s) => (
                    <tr key={s.id} className="hover:bg-muted/30">
                      <td className="py-2 font-mono text-primary">{s.invoiceNumber}</td>
                      <td className="py-2 text-muted-foreground">
                        {new Date(s.createdAt).toLocaleDateString(undefined, { day: "2-digit", month: "short" })}
                      </td>
                      <td className="py-2 max-w-[120px] truncate">{s.customerName}</td>
                      <td className="py-2 text-end font-semibold">{formatMoney(s.total, currency)}</td>
                      <td className="py-2 text-end">
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] capitalize">
                          {s.payment}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Outstanding debt */}
        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <div className="mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-warning" />
            <h3 className="font-bold text-sm">Dettes clients</h3>
          </div>
          <p className="text-2xl font-extrabold text-warning">{formatMoney(stats.totalDebt, currency)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {customers.filter((c) => c.balance > 0).length} client(s) avec solde
          </p>
          <div className="mt-3 space-y-1 max-h-[140px] overflow-y-auto">
            {customers.filter((c) => c.balance > 0).map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-muted/40">
                <span className="text-xs truncate max-w-[110px]">{c.name}</span>
                <span className="text-xs font-semibold text-warning">{formatMoney(c.balance, currency)}</span>
              </div>
            ))}
            {customers.filter((c) => c.balance > 0).length === 0 && (
              <p className="text-xs text-muted-foreground py-3 text-center">✅ Aucune dette</p>
            )}
          </div>
        </div>
      </div>
    </PageBody>
  );
}

/* ─── Sub-components ─── */
function KpiCard({
  label, value, sub, Icon, color, trend, alert,
}: {
  label: string; value: string; sub: string;
  Icon: React.ComponentType<{ className?: string }>;
  color: string; trend?: "up" | "down"; alert?: boolean;
}) {
  return (
    <div className={`rounded-2xl border bg-card p-5 shadow-card ${alert ? "border-warning/40" : ""}`}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground leading-tight">{label}</p>
        <Icon className={`h-5 w-5 shrink-0 ${color}`} />
      </div>
      <p className={`mt-3 text-xl font-extrabold ${color}`}>{value}</p>
      <div className="mt-1 flex items-center gap-1">
        {trend === "up" && <ArrowUpRight className="h-3 w-3 text-success" />}
        {trend === "down" && <ArrowDownRight className="h-3 w-3 text-destructive" />}
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}
