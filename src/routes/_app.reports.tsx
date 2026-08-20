import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  TrendingUp, Package, DollarSign, FileDown, FileSpreadsheet,
  BarChart3, AlertTriangle, ArrowLeftRight, Users, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useMBStore, formatMoney } from "@/lib/mb-store";
import { PageBody, PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/_app/reports")({ component: ReportsPage });

const COLORS = ["#1e3a5f", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
type Range = "day" | "week" | "month" | "year";
type Tab = "sales" | "inventory" | "financial";

/* ─── Date helpers ─── */
const rangeStart: Record<Range, () => Date> = {
  day: () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; },
  week: () => new Date(Date.now() - 7 * 86400000),
  month: () => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; },
  year: () => new Date(new Date().getFullYear(), 0, 1),
};

function ReportsPage() {
  const sales      = useMBStore((s) => s.sales);
  const products   = useMBStore((s) => s.products);
  const expenses   = useMBStore((s) => s.expenses);
  const customers  = useMBStore((s) => s.customers);
  const movements  = useMBStore((s) => s.movements);
  const currency   = useMBStore((s) => s.settings.currency);
  const company    = useMBStore((s) => s.settings.name);

  const [range, setRange] = useState<Range>("month");
  const [tab, setTab]     = useState<Tab>("sales");
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);

  const data = useMemo(() => {
    const from = rangeStart[range]();
    const rSales = sales.filter(
      (s) => new Date(s.createdAt) >= from && s.status === "completed",
    );
    const rExp = expenses.filter((e) => new Date(e.createdAt) >= from);
    const rMov = movements.filter((m) => new Date(m.createdAt) >= from);

    const totalRev = rSales.reduce((a, s) => a + s.total, 0);
    const totalExp = rExp.reduce((a, e) => a + e.amount, 0);
    const profit   = totalRev - totalExp;

    // Daily breakdown (last 30 points)
    const days = range === "year" ? 12 : range === "month" ? 30 : range === "week" ? 7 : 24;
    const unit = range === "year" ? "month" : range === "day" ? "hour" : "day";
    const dailyMap: Record<string, { name: string; revenue: number; expenses: number; count: number }> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      let key: string;
      if (unit === "hour") {
        d.setHours(d.getHours() - i, 0, 0, 0);
        key = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
      } else if (unit === "month") {
        d.setMonth(d.getMonth() - i, 1); d.setHours(0, 0, 0, 0);
        key = d.toLocaleDateString(undefined, { month: "short" });
      } else {
        d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
        key = d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
      }
      dailyMap[key] = { name: key, revenue: 0, expenses: 0, count: 0 };
    }
    rSales.forEach((s) => {
      const d = new Date(s.createdAt);
      let key: string;
      if (unit === "hour") key = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
      else if (unit === "month") key = d.toLocaleDateString(undefined, { month: "short" });
      else key = d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
      if (dailyMap[key]) { dailyMap[key].revenue += s.total; dailyMap[key].count++; }
    });
    rExp.forEach((e) => {
      const d = new Date(e.createdAt);
      let key: string;
      if (unit === "hour") key = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
      else if (unit === "month") key = d.toLocaleDateString(undefined, { month: "short" });
      else key = d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
      if (dailyMap[key]) dailyMap[key].expenses += e.amount;
    });
    const dailyData = Object.values(dailyMap).map((d) => ({
      ...d, revenue: +d.revenue.toFixed(0), expenses: +d.expenses.toFixed(0),
    }));

    // Top products by revenue
    const pMap: Record<string, { name: string; revenue: number; qty: number }> = {};
    rSales.forEach((s) =>
      s.items.forEach((it) => {
        if (!pMap[it.productId]) pMap[it.productId] = { name: it.name, revenue: 0, qty: 0 };
        pMap[it.productId].revenue += it.subtotal;
        pMap[it.productId].qty += it.quantity;
      }),
    );
    const topProducts = Object.values(pMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8)
      .map((x) => ({ name: x.name.slice(0, 18), revenue: +x.revenue.toFixed(0), qty: x.qty }));

    // Payment methods
    const payMap: Record<string, number> = {};
    rSales.forEach((s) => { payMap[s.payment] = (payMap[s.payment] ?? 0) + 1; });
    const payData = Object.entries(payMap).map(([name, value]) => ({ name, value }));

    // Expenses by category
    const expCatMap: Record<string, number> = {};
    rExp.forEach((e) => { expCatMap[e.type] = (expCatMap[e.type] ?? 0) + e.amount; });
    const expCatData = Object.entries(expCatMap).map(([name, value]) => ({ name, value: +value.toFixed(0) }));

    // Stock analytics
    const stockVal  = products.reduce((a, p) => a + p.cost * p.stock, 0);
    const lowStock  = products.filter((p) => p.stock <= p.minStock && p.active);
    const outOfStock = products.filter((p) => p.stock <= 0 && p.active);

    // Inventory by category (top 8)
    const catStockMap: Record<string, number> = {};
    products.forEach((p) => {
      const cat = p.categoryId ?? "Uncategorized";
      catStockMap[cat] = (catStockMap[cat] ?? 0) + p.cost * p.stock;
    });
    const catStockData = Object.entries(catStockMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name: name.slice(0, 14), value: +value.toFixed(0) }));

    // Outstanding customer debt
    const debtCustomers = customers.filter((c) => c.balance > 0);
    const totalDebt = debtCustomers.reduce((a, c) => a + c.balance, 0);

    // Margin by product (top 5)
    const margins = products
      .filter((p) => p.price > 0)
      .map((p) => ({
        name: p.name.slice(0, 16),
        margin: +(((p.price - p.cost) / p.price) * 100).toFixed(1),
        profit: p.price - p.cost,
      }))
      .sort((a, b) => b.margin - a.margin)
      .slice(0, 8);

    return {
      totalRev, totalExp, profit, count: rSales.length,
      stockVal, lowStock, outOfStock, catStockData,
      dailyData, topProducts, payData, expCatData,
      debtCustomers, totalDebt, margins,
      rSales, rExp, rMov,
    };
  }, [sales, products, expenses, customers, movements, range]);

  const handleExport = async (type: "pdf" | "xlsx") => {
    setExporting(type);
    try {
      const { exportPdf, exportExcel } = await import("@/lib/report-export");
      if (type === "pdf") {
        await exportPdf({
          sales: data.rSales, products, expenses: data.rExp,
          currency, range, companyName: company,
        });
      } else {
        await exportExcel({
          sales: data.rSales, products, expenses: data.rExp,
          customers, movements: data.rMov, currency, range,
        });
      }
      toast.success(type === "pdf" ? "PDF téléchargé" : "Excel téléchargé");
    } catch (e) {
      toast.error("Erreur d'export: " + (e as Error).message);
    } finally {
      setExporting(null);
    }
  };

  const ranges: { key: Range; label: string }[] = [
    { key: "day", label: "Jour" },
    { key: "week", label: "Semaine" },
    { key: "month", label: "Mois" },
    { key: "year", label: "Année" },
  ];

  const tabs: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "sales", label: "Ventes", icon: TrendingUp },
    { key: "inventory", label: "Inventaire", icon: Package },
    { key: "financial", label: "Financier", icon: BarChart3 },
  ];

  return (
    <PageBody>
      <PageHeader
        title="Rapports & Analyses"
        description="Tableaux de bord et indicateurs de performance"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport("pdf")}
              disabled={exporting !== null}
              className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm font-semibold hover:bg-accent disabled:opacity-50"
            >
              {exporting === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              PDF
            </button>
            <button
              onClick={() => handleExport("xlsx")}
              disabled={exporting !== null}
              className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm font-semibold hover:bg-accent disabled:opacity-50"
            >
              {exporting === "xlsx" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              Excel
            </button>
          </div>
        }
      />

      {/* Summary KPIs */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Chiffre d'affaires", value: formatMoney(data.totalRev, currency), sub: `${data.count} ventes`, color: "text-primary", Icon: TrendingUp },
          { label: "Dépenses", value: formatMoney(data.totalExp, currency), sub: "Période sélectionnée", color: "text-destructive", Icon: DollarSign },
          { label: "Bénéfice net", value: formatMoney(data.profit, currency), sub: "CA − Dépenses", color: data.profit >= 0 ? "text-success" : "text-destructive", Icon: BarChart3 },
          { label: "Valeur du stock", value: formatMoney(data.stockVal, currency), sub: `${data.lowStock.length} en rupture`, color: "text-info", Icon: Package },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border bg-card p-4 shadow-card">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{c.label}</p>
              <c.Icon className={`h-4 w-4 shrink-0 ${c.color}`} />
            </div>
            <p className={`mt-3 text-xl font-extrabold ${c.color}`}>{c.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Period + Tab selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-xl border bg-card p-1 gap-1">
          {ranges.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
                range === r.key ? "bg-primary text-primary-foreground shadow" : "hover:bg-accent"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex rounded-xl border bg-card p-1 gap-1">
          {tabs.map((tb) => {
            const Icon = tb.icon;
            return (
              <button
                key={tb.key}
                onClick={() => setTab(tb.key)}
                className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
                  tab === tb.key ? "bg-primary text-primary-foreground shadow" : "hover:bg-accent"
                }`}
              >
                <Icon className="h-4 w-4" /> {tb.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── SALES TAB ─── */}
      {tab === "sales" && (
        <div className="space-y-6">
          {/* Revenue trend */}
          <div className="rounded-2xl border bg-card p-5 shadow-card">
            <h3 className="mb-4 font-bold text-sm">Évolution du chiffre d'affaires</h3>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data.dailyData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1e3a5f" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#1e3a5f" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={65}
                  tickFormatter={(v) => v === 0 ? "0" : `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 10 }}
                  formatter={(v: number) => [formatMoney(v, currency), ""]}
                />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="revenue" name="Ventes" stroke="#1e3a5f" strokeWidth={2} fill="url(#gRev)" />
                <Area type="monotone" dataKey="expenses" name="Dépenses" stroke="#ef4444" strokeWidth={2} fill="none" strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Top products */}
            <div className="rounded-2xl border bg-card p-5 shadow-card">
              <h3 className="mb-4 font-bold text-sm">Top produits — CA</h3>
              {data.topProducts.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.topProducts} layout="vertical" margin={{ left: 0, right: 20 }}>
                    <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={100} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10 }}
                      formatter={(v: number) => [formatMoney(v, currency), "CA"]} />
                    <Bar dataKey="revenue" fill="#1e3a5f" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </div>

            {/* Payment methods */}
            <div className="rounded-2xl border bg-card p-5 shadow-card">
              <h3 className="mb-4 font-bold text-sm">Modes de paiement</h3>
              {data.payData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={data.payData} cx="50%" cy="45%" innerRadius={55} outerRadius={85}
                      paddingAngle={3} dataKey="value">
                      {data.payData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10 }}
                      formatter={(v: number) => [`${v} ventes`, ""]} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </div>
          </div>

          {/* Sales table */}
          <div className="rounded-2xl border bg-card p-5 shadow-card">
            <h3 className="mb-3 font-bold text-sm">Détail des ventes ({data.rSales.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b text-muted-foreground">
                  {["Facture", "Date", "Client", "Articles", "Sous-total", "Remise", "Total", "Mode", "Statut"].map((h) => (
                    <th key={h} className="pb-2 px-2 text-start font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y">
                  {data.rSales.length === 0 ? (
                    <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">Aucune vente sur cette période</td></tr>
                  ) : (
                    data.rSales.slice(0, 50).map((s) => (
                      <tr key={s.id} className="hover:bg-muted/30">
                        <td className="py-2 px-2 font-mono text-primary whitespace-nowrap">{s.invoiceNumber}</td>
                        <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">
                          {new Date(s.createdAt).toLocaleDateString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="py-2 px-2 max-w-[120px] truncate">{s.customerName}</td>
                        <td className="py-2 px-2 text-center">{s.items.length}</td>
                        <td className="py-2 px-2 text-end">{formatMoney(s.subtotal, currency)}</td>
                        <td className="py-2 px-2 text-end text-muted-foreground">{s.discount > 0 ? formatMoney(s.discount, currency) : "—"}</td>
                        <td className="py-2 px-2 text-end font-semibold">{formatMoney(s.total, currency)}</td>
                        <td className="py-2 px-2"><span className="rounded-md bg-muted px-1.5 py-0.5 capitalize">{s.payment}</span></td>
                        <td className="py-2 px-2">
                          <span className={`rounded-md px-1.5 py-0.5 capitalize ${s.status === "completed" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {data.rSales.length > 50 && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Affichage des 50 premières lignes. Exportez en Excel pour voir tout.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── INVENTORY TAB ─── */}
      {tab === "inventory" && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Articles en stock" value={String(products.filter((p) => p.stock > 0 && p.active).length)} icon={Package} />
            <StatCard label="Stock bas / Rupture" value={`${data.lowStock.length} / ${data.outOfStock.length}`} icon={AlertTriangle} alert />
            <StatCard label="Valeur totale stock" value={formatMoney(data.stockVal, currency)} icon={DollarSign} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Stock value by category */}
            <div className="rounded-2xl border bg-card p-5 shadow-card">
              <h3 className="mb-4 font-bold text-sm">Valeur stock par catégorie</h3>
              {data.catStockData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.catStockData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={60}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10 }}
                      formatter={(v: number) => [formatMoney(v, currency), "Valeur"]} />
                    <Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </div>

            {/* Low stock alerts */}
            <div className="rounded-2xl border bg-card p-5 shadow-card">
              <h3 className="mb-3 font-bold text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Articles à surveiller ({data.lowStock.length})
              </h3>
              <div className="space-y-2 max-h-[240px] overflow-y-auto">
                {data.lowStock.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">✅ Tous les stocks sont OK</p>
                ) : (
                  data.lowStock.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-xl border px-3 py-2">
                      <div>
                        <p className="text-xs font-semibold">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground">SKU: {p.sku} · Min: {p.minStock}</p>
                      </div>
                      <div className="text-end">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          p.stock <= 0 ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"
                        }`}>
                          {p.stock <= 0 ? "Rupture" : p.stock}
                        </span>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{formatMoney(p.cost * p.stock, currency)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Full inventory table */}
          <div className="rounded-2xl border bg-card p-5 shadow-card">
            <h3 className="mb-3 font-bold text-sm">Inventaire complet ({products.length} articles)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b text-muted-foreground">
                  {["SKU", "Produit", "Stock", "Min", "Coût unitaire", "Prix vente", "Valeur stock", "Marge %", "Statut"].map((h) => (
                    <th key={h} className="pb-2 px-2 text-start font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y">
                  {products.map((p) => {
                    const val = p.cost * p.stock;
                    const margin = p.price > 0 ? (((p.price - p.cost) / p.price) * 100).toFixed(1) : "—";
                    const status = !p.active ? "Inactif" : p.stock <= 0 ? "Rupture" : p.stock <= p.minStock ? "Bas" : "OK";
                    return (
                      <tr key={p.id} className="hover:bg-muted/30">
                        <td className="py-2 px-2 font-mono text-xs text-muted-foreground">{p.sku}</td>
                        <td className="py-2 px-2 font-medium">{p.name}</td>
                        <td className="py-2 px-2 text-center font-semibold">{p.stock}</td>
                        <td className="py-2 px-2 text-center text-muted-foreground">{p.minStock}</td>
                        <td className="py-2 px-2 text-end">{formatMoney(p.cost, currency)}</td>
                        <td className="py-2 px-2 text-end">{formatMoney(p.price, currency)}</td>
                        <td className="py-2 px-2 text-end font-semibold">{formatMoney(val, currency)}</td>
                        <td className="py-2 px-2 text-end">{typeof margin === "string" ? margin : `${margin}%`}</td>
                        <td className="py-2 px-2">
                          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                            status === "Rupture" ? "bg-destructive/10 text-destructive" :
                            status === "Bas" ? "bg-warning/10 text-warning" :
                            status === "Inactif" ? "bg-muted text-muted-foreground" :
                            "bg-success/10 text-success"
                          }`}>{status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Stock movements */}
          <div className="rounded-2xl border bg-card p-5 shadow-card">
            <div className="mb-3 flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-primary" />
              <h3 className="font-bold text-sm">Mouvements de stock — période</h3>
              <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-bold">
                {data.rMov.length}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b text-muted-foreground">
                  {["Date", "Produit", "Type", "Avant", "Qté", "Après", "Raison"].map((h) => (
                    <th key={h} className="pb-2 px-2 text-start font-medium">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y">
                  {data.rMov.length === 0 ? (
                    <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">Aucun mouvement</td></tr>
                  ) : (
                    data.rMov.slice(0, 40).map((m) => (
                      <tr key={m.id} className="hover:bg-muted/30">
                        <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">
                          {new Date(m.createdAt).toLocaleDateString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="py-2 px-2 truncate max-w-[120px]">{m.productName}</td>
                        <td className="py-2 px-2">
                          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                            m.type === "in" ? "bg-success/10 text-success" :
                            m.type === "out" ? "bg-destructive/10 text-destructive" :
                            "bg-info/10 text-info"
                          }`}>{m.type}</span>
                        </td>
                        <td className="py-2 px-2 text-center">{m.before}</td>
                        <td className="py-2 px-2 text-center font-semibold">{m.quantity}</td>
                        <td className="py-2 px-2 text-center">{m.after}</td>
                        <td className="py-2 px-2 text-muted-foreground truncate max-w-[120px]">{m.reason ?? "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── FINANCIAL TAB ─── */}
      {tab === "financial" && (
        <div className="space-y-6">
          {/* P&L overview */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Chiffre d'affaires" value={formatMoney(data.totalRev, currency)} icon={TrendingUp} />
            <StatCard label="Total dépenses" value={formatMoney(data.totalExp, currency)} icon={DollarSign} />
            <StatCard label="Bénéfice net" value={formatMoney(data.profit, currency)} icon={BarChart3}
              alert={data.profit < 0} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Revenue vs Expenses area chart */}
            <div className="rounded-2xl border bg-card p-5 shadow-card">
              <h3 className="mb-4 font-bold text-sm">CA vs Dépenses</h3>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={data.dailyData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gR2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1e3a5f" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#1e3a5f" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gE2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={65}
                    tickFormatter={(v) => v === 0 ? "0" : `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10 }}
                    formatter={(v: number) => [formatMoney(v, currency), ""]} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="revenue" name="CA" stroke="#1e3a5f" strokeWidth={2} fill="url(#gR2)" />
                  <Area type="monotone" dataKey="expenses" name="Dépenses" stroke="#ef4444" strokeWidth={2} fill="url(#gE2)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Expenses by type */}
            <div className="rounded-2xl border bg-card p-5 shadow-card">
              <h3 className="mb-4 font-bold text-sm">Répartition des dépenses</h3>
              {data.expCatData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={data.expCatData} cx="50%" cy="45%" innerRadius={55} outerRadius={85}
                      paddingAngle={3} dataKey="value">
                      {data.expCatData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10 }}
                      formatter={(v: number) => [formatMoney(v, currency), ""]} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </div>
          </div>

          {/* Margin by product */}
          <div className="rounded-2xl border bg-card p-5 shadow-card">
            <h3 className="mb-4 font-bold text-sm">Marge bénéficiaire par produit (catalogue)</h3>
            {data.margins.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.margins} layout="vertical" margin={{ left: 0, right: 30 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                    tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={105} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10 }}
                    formatter={(v: number) => [`${v}%`, "Marge"]} />
                  <Bar dataKey="margin" fill="#10b981" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty />}
          </div>

          {/* Customer debt */}
          <div className="rounded-2xl border bg-card p-5 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-warning" />
                <h3 className="font-bold text-sm">Créances clients</h3>
              </div>
              <span className="text-sm font-bold text-warning">{formatMoney(data.totalDebt, currency)}</span>
            </div>
            {data.debtCustomers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">✅ Aucune créance en cours</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b text-muted-foreground">
                    {["Client", "Téléphone", "Solde dû", "% du total"].map((h) => (
                      <th key={h} className="pb-2 px-2 text-start font-medium">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody className="divide-y">
                    {data.debtCustomers.sort((a, b) => b.balance - a.balance).map((c) => (
                      <tr key={c.id} className="hover:bg-muted/30">
                        <td className="py-2 px-2 font-medium">{c.name}</td>
                        <td className="py-2 px-2 text-muted-foreground">{c.phone ?? "—"}</td>
                        <td className="py-2 px-2 font-semibold text-warning">{formatMoney(c.balance, currency)}</td>
                        <td className="py-2 px-2 text-muted-foreground">
                          {data.totalDebt > 0 ? `${((c.balance / data.totalDebt) * 100).toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Expense list */}
          <div className="rounded-2xl border bg-card p-5 shadow-card">
            <h3 className="mb-3 font-bold text-sm">Détail des dépenses ({data.rExp.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b text-muted-foreground">
                  {["Date", "Description", "Montant", "Type"].map((h) => (
                    <th key={h} className="pb-2 px-2 text-start font-medium">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y">
                  {data.rExp.length === 0 ? (
                    <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">Aucune dépense</td></tr>
                  ) : (
                    data.rExp.map((e) => (
                      <tr key={e.id} className="hover:bg-muted/30">
                        <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">
                          {new Date(e.createdAt).toLocaleDateString(undefined, { day: "2-digit", month: "short" })}
                        </td>
                        <td className="py-2 px-2">{e.description}</td>
                        <td className="py-2 px-2 font-semibold text-destructive">{formatMoney(e.amount, currency)}</td>
                        <td className="py-2 px-2">
                          <span className="rounded-md bg-muted px-1.5 py-0.5 capitalize">{e.type}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </PageBody>
  );
}

function Empty() {
  return (
    <div className="grid h-[220px] place-items-center text-sm text-muted-foreground">
      Aucune donnée pour cette période
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, alert,
}: {
  label: string; value: string;
  icon: React.ComponentType<{ className?: string }>;
  alert?: boolean;
}) {
  return (
    <div className={`rounded-2xl border bg-card p-4 shadow-card ${alert ? "border-destructive/30" : ""}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        <Icon className={`h-4 w-4 ${alert ? "text-destructive" : "text-primary"}`} />
      </div>
      <p className={`text-xl font-extrabold ${alert ? "text-destructive" : "text-foreground"}`}>{value}</p>
    </div>
  );
}
