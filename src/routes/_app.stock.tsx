import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Package, DollarSign, Tag, AlertTriangle, XCircle, ArrowDown, ArrowUp, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { useMBStore, formatMoney } from "@/lib/mb-store";
import { PageBody, PageHeader } from "@/components/app-shell";
import { useAuthStore } from "@/lib/auth";

export const Route = createFileRoute("/_app/stock")({ component: StockPage });

function StockPage() {
  const products = useMBStore((s) => s.products);
  const upsertProduct = useMBStore((s) => s.upsertProduct);
  const addMovement = useMBStore((s) => s.addMovement);
  const session = useAuthStore((s) => s.session);
  const currency = useMBStore((s) => s.settings.currency);
  const [q, setQ] = useState("");
  const [adjustFor, setAdjustFor] = useState<{ productId: string; type: "in" | "out" | "adj" } | null>(null);
  const [amount, setAmount] = useState(1);
  const [reason, setReason] = useState("");

  const stats = useMemo(() => ({
    total: products.length,
    stockValue: products.reduce((a, p) => a + p.cost * p.stock, 0),
    retailValue: products.reduce((a, p) => a + p.price * p.stock, 0),
    low: products.filter((p) => p.stock > 0 && p.stock <= p.minStock).length,
    out: products.filter((p) => p.stock <= 0).length,
  }), [products]);

  const filtered = products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase()));

  const submitAdjust = () => {
    if (!adjustFor) return;
    const p = products.find((x) => x.id === adjustFor.productId);
    if (!p) return;
    const before = p.stock;
    const after = adjustFor.type === "in" ? before + amount : adjustFor.type === "out" ? before - amount : amount;
    upsertProduct({ ...p, stock: after });
    addMovement({
      id: crypto.randomUUID(),
      productId: p.id, productName: p.name,
      type: adjustFor.type,
      quantity: Math.abs(after - before),
      before, after, reason,
      userId: session?.userId ?? "unknown",
      createdAt: new Date().toISOString(),
    });
    toast.success("Stock mis à jour");
    setAdjustFor(null); setAmount(1); setReason("");
  };

  return (
    <PageBody>
      <PageHeader title="Stock Management" description="Monitor and manage your inventory levels across all locations" />

      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        <StatCard icon={Package} color="bg-info/10 text-info" title="Total Products" value={String(stats.total)} />
        <StatCard icon={DollarSign} color="bg-success/10 text-success" title="Total Stock Value" value={formatMoney(stats.stockValue, currency)} sub="Based on cost price" />
        <StatCard icon={Tag} color="bg-success/10 text-success" title="Retail Value" value={formatMoney(stats.retailValue, currency)} sub="Based on selling price" />
        <StatCard icon={AlertTriangle} color="bg-warning/15 text-warning" title="Low Stock Alerts" value={String(stats.low)} sub="Below reorder level" />
        <StatCard icon={XCircle} color="bg-destructive/10 text-destructive" title="Out of Stock" value={String(stats.out)} sub="Requires attention" />
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-card">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by product name, SKU..." className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-4 text-right">Product</th>
              <th className="p-4 text-right">Available Stock</th>
              <th className="p-4 text-right">Inventory Value</th>
              <th className="p-4 text-right">Availability</th>
              <th className="p-4 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-muted/20">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    {p.image ? <img src={p.image} className="h-12 w-12 rounded-xl object-cover" /> : <div className="h-12 w-12 rounded-xl bg-muted" />}
                    <div><p className="font-bold">{p.name}</p><p className="text-xs font-mono text-muted-foreground">SKU: {p.sku}</p></div>
                  </div>
                </td>
                <td className="p-4"><p className="text-2xl font-extrabold">{p.stock} <span className="text-xs text-muted-foreground">pcs</span></p><p className="text-xs text-muted-foreground">Min: {p.minStock}</p></td>
                <td className="p-4"><p className="font-bold">{formatMoney(p.cost * p.stock, currency)}</p><p className="text-xs text-muted-foreground">{formatMoney(p.cost, currency)} / unit</p></td>
                <td className="p-4">
                  {p.stock <= 0 ? <span className="rounded-full bg-destructive/10 text-destructive px-3 py-1 text-xs font-semibold">OUT OF STOCK</span> :
                   p.stock <= p.minStock ? <span className="rounded-full bg-warning/20 text-warning px-3 py-1 text-xs font-semibold">LOW STOCK</span> :
                   <span className="rounded-full bg-success/15 text-success px-3 py-1 text-xs font-semibold">✓ ADEQUATE STOCK</span>}
                </td>
                <td className="p-4">
                  <div className="flex items-center justify-end gap-1">
                    <button title="Augmenter" onClick={() => setAdjustFor({ productId: p.id, type: "in" })} className="grid h-8 w-8 place-items-center rounded-lg text-success hover:bg-success/10"><ArrowDown className="h-4 w-4" /></button>
                    <button title="Diminuer" onClick={() => setAdjustFor({ productId: p.id, type: "out" })} className="grid h-8 w-8 place-items-center rounded-lg text-warning hover:bg-warning/10"><ArrowUp className="h-4 w-4" /></button>
                    <button title="Inventaire" onClick={() => setAdjustFor({ productId: p.id, type: "adj" })} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent"><Settings2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adjustFor && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setAdjustFor(null)}>
          <div className="w-full max-w-md rounded-2xl bg-card p-5" onClick={(e) => e.stopPropagation()} dir="ltr">
            <h2 className="text-lg font-bold mb-1">{adjustFor.type === "in" ? "Augmenter le stock" : adjustFor.type === "out" ? "Diminuer le stock" : "Inventaire"}</h2>
            <p className="text-xs text-muted-foreground mb-4">{products.find((p) => p.id === adjustFor.productId)?.name}</p>
            <label className="block mb-3"><span className="text-xs">{adjustFor.type === "adj" ? "Quantité réelle" : "Quantité"}</span><input type="number" value={amount} onChange={(e) => setAmount(+e.target.value)} className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm" /></label>
            <label className="block mb-4"><span className="text-xs">Raison</span><input value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm" /></label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setAdjustFor(null)} className="rounded-xl border px-4 py-2 text-sm">Annuler</button>
              <button onClick={submitAdjust} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Confirmer</button>
            </div>
          </div>
        </div>
      )}
    </PageBody>
  );
}

function StatCard({ icon: Icon, color, title, value, sub }: { icon: React.ComponentType<{className?:string}>; color: string; title: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-card">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-extrabold truncate">{value}</p>
          {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${color}`}><Icon className="h-5 w-5" /></div>
      </div>
    </div>
  );
}
