import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Eye, Printer, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useMBStore, formatMoney, type Sale } from "@/lib/mb-store";
import { PageBody, PageHeader } from "@/components/app-shell";
import { Link } from "@tanstack/react-router";
import { printSaleReceipt } from "@/lib/print";


export const Route = createFileRoute("/_app/sales")({
  component: SalesPage,
});

function SalesPage() {
  const sales = useMBStore((s) => s.sales);
  const currency = useMBStore((s) => s.settings.currency);
  const settings = useMBStore((s) => s.settings);
  const users = useMBStore((s) => s.users);
  const updateSale = useMBStore((s) => s.updateSale);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [range, setRange] = useState("30d");
  const [viewing, setViewing] = useState<Sale | null>(null);


  const filtered = useMemo(() => {
    const now = Date.now();
    const days: Record<string, number> = { today: 1, "7d": 7, "30d": 30, month: 31, all: 99999 };
    const limit = now - days[range] * 86400000;
    return sales.filter((s) => {
      if (status !== "all" && s.status !== status) return false;
      if (new Date(s.createdAt).getTime() < limit) return false;
      if (q && !s.invoiceNumber.toLowerCase().includes(q.toLowerCase()) && !s.customerName.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [sales, q, status, range]);

  const refund = (id: string) => {
    const s = sales.find((x) => x.id === id);
    if (!s) return;
    if (!confirm("Confirmer le remboursement de la facture ?")) return;
    updateSale({ ...s, status: "refunded" });
    toast.success("Remboursé");
  };

  const reprint = (sale: Sale) => {
    const cashier = users.find((u) => u.id === sale.cashierId)?.displayName ?? "—";
    printSaleReceipt(sale, settings, cashier).catch(() => toast.error("Échec de l'impression"));
  };


  return (
    <PageBody>
      <PageHeader
        title="Sales History"
        description="View and manage all sales transactions"
        actions={
          <Link to="/pos" className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-primary hover:bg-primary-hover">
            <Plus className="h-4 w-4" /> New Sale
          </Link>
        }
      />

      <div className="rounded-2xl border bg-card p-4 shadow-card">
        <div className="grid gap-3 md:grid-cols-4">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by invoice or customer..." className="rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring md:col-span-2" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border bg-background px-3 py-2.5 text-sm outline-none">
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="refunded">Refunded</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <div className="flex gap-1">
            {[["today","Today"],["7d","Last 7"],["30d","Last 30"],["all","All"]].map(([v,l]) => (
              <button key={v} onClick={() => setRange(v)} className={`flex-1 rounded-xl px-2 py-2 text-xs font-semibold ${range===v ? "bg-primary text-primary-foreground" : "border hover:bg-accent"}`}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <div className="border-b p-4 text-sm">Showing <span className="font-bold">{filtered.length}</span> sales</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-4 text-right">Invoice #</th>
                <th className="p-4 text-right">Date &amp; Time</th>
                <th className="p-4 text-right">Customer</th>
                <th className="p-4 text-right">Items</th>
                <th className="p-4 text-right">Payment</th>
                <th className="p-4 text-right">Total</th>
                <th className="p-4 text-right">Status</th>
                <th className="p-4 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-muted/20">
                  <td className="p-4 font-mono font-semibold text-primary">{s.invoiceNumber}</td>
                  <td className="p-4"><p>{s.createdAt.slice(0, 10)}</p><p className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleTimeString("en-GB", {hour:"2-digit",minute:"2-digit"})}</p></td>
                  <td className="p-4">{s.customerName}</td>
                  <td className="p-4"><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">{s.items.length} items</span></td>
                  <td className="p-4 capitalize">{s.payment}</td>
                  <td className="p-4 font-bold">{formatMoney(s.total, currency)}</td>
                  <td className="p-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      s.status === "completed" ? "bg-success/15 text-success" :
                      s.status === "refunded" ? "bg-destructive/10 text-destructive" :
                      "bg-muted text-muted-foreground"
                    }`}>{s.status}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setViewing(s)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent" title="Voir"><Eye className="h-4 w-4" /></button>
                      <button onClick={() => reprint(s)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent" title="Imprimer le reçu"><Printer className="h-4 w-4" /></button>

                      {s.status === "completed" && (
                        <button onClick={() => refund(s.id)} className="grid h-8 w-8 place-items-center rounded-lg text-destructive hover:bg-destructive/10"><RotateCcw className="h-4 w-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="p-12 text-center text-muted-foreground">Aucune facture</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {viewing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setViewing(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-card shadow-elevated" onClick={(e) => e.stopPropagation()} dir="ltr">
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="text-lg font-bold">Facture {viewing.invoiceNumber}</h2>
              <button onClick={() => setViewing(null)} className="rounded-lg px-2 py-1 hover:bg-accent">✕</button>
            </div>
            <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{new Date(viewing.createdAt).toLocaleString("fr-FR")}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Client</span><span>{viewing.customerName}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Paiement</span><span className="capitalize">{viewing.payment}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Statut</span><span>{viewing.status}</span></div>
              <div className="rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs"><tr><th className="p-2 text-right">Produit</th><th className="p-2">Quantité</th><th className="p-2 text-left">Total</th></tr></thead>
                  <tbody className="divide-y">
                    {viewing.items.map((it) => (
                      <tr key={it.productId}><td className="p-2">{it.name}</td><td className="p-2 text-center">{it.quantity}</td><td className="p-2 text-left">{formatMoney(it.subtotal, currency)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between border-t pt-3 font-bold"><span>Total</span><span>{formatMoney(viewing.total, currency)}</span></div>
            </div>
            <div className="flex justify-end gap-2 border-t p-4">
              <button onClick={() => setViewing(null)} className="rounded-xl border px-4 py-2 text-sm hover:bg-accent">Fermer</button>
              <button onClick={() => { reprint(viewing); }} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">Imprimer</button>
            </div>
          </div>
        </div>
      )}
    </PageBody>
  );

}
