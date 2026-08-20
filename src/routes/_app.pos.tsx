import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { publishDisplayCart } from "@/lib/sync/display-channel";

import { toast } from "sonner";
import {
  Search, Plus, Minus, Trash2, Pause, Printer, CheckCircle2,
  Banknote, CreditCard, Smartphone, ArrowLeftRight, ScanLine,
  UserPlus, Scale, History, X, Clock,
} from "lucide-react";
import {
  useMBStore, formatMoney, nextInvoiceNumber,
  type SaleItem, type PaymentMethod, type Sale, type Product,
} from "@/lib/mb-store";
import { useAuthStore } from "@/lib/auth";
import { printSaleReceipt } from "@/lib/print";

export const Route = createFileRoute("/_app/pos")({
  component: POSPage,
});

/* ─── Weight-entry modal ─── */
interface WeightModalState { product: Product; inputVal: string; }

function WeightModal({ state, currency, onConfirm, onClose }: {
  state: WeightModalState; currency: string;
  onConfirm: (qty: number) => void; onClose: () => void;
}) {
  const { product } = state;
  const [val, setVal] = useState(state.inputVal);
  const qty = parseFloat(val) || 0;
  const subtotal = Math.round(product.price * qty * 100) / 100;
  const unit = product.unit ?? "";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-card shadow-elevated p-5 space-y-4" dir="ltr" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold">{product.name}</h3>
        <div className="flex items-center gap-2 rounded-xl border bg-muted/40 px-4 py-3">
          <Scale className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground">Prix : {formatMoney(product.price, currency)} / {unit}</span>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Entrez la quantité ({unit})</label>
          <input
            type="number" step="0.001" min="0" value={val}
            onChange={(e) => setVal(e.target.value)} autoFocus
            onKeyDown={(e) => { if (e.key === "Enter" && qty > 0) onConfirm(qty); }}
            className="w-full rounded-xl border bg-background px-3 py-3 text-2xl font-bold outline-none focus:ring-2 focus:ring-ring text-center"
            placeholder="0.000"
          />
        </div>
        <div className="flex items-center justify-between rounded-xl border-2 border-primary/30 bg-primary/5 px-4 py-3">
          <span className="text-sm font-medium text-muted-foreground">Total</span>
          <span className="text-xl font-extrabold text-primary">{formatMoney(subtotal, currency)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button onClick={onClose} className="rounded-xl border py-2.5 text-sm font-semibold hover:bg-accent">Annuler</button>
          <button disabled={qty <= 0} onClick={() => onConfirm(qty)}
            className="rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-40">
            Ajouter au panier
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Held Sales Modal ─── */
function HeldSalesModal({ heldSales, currency, onRestore, onClose }: {
  heldSales: Sale[]; currency: string;
  onRestore: (sale: Sale) => void; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-card shadow-elevated" dir="ltr" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold">Ventes en attente</h3>
            <span className="rounded-full bg-warning/15 text-warning px-2 py-0.5 text-xs font-bold">{heldSales.length}</span>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto divide-y">
          {heldSales.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Aucune vente en attente</div>
          ) : heldSales.map((s) => (
            <div key={s.id} className="flex items-center gap-4 p-4 hover:bg-muted/30">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-warning/10 text-warning shrink-0">
                <Clock className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">{s.customerName}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(s.createdAt).toLocaleString("fr-FR")} · {s.items.length} produit
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {s.items.map((i) => i.name).join(" · ")}
                </p>
              </div>
              <div className="text-end shrink-0">
                <p className="font-extrabold text-primary">{formatMoney(s.total, currency)}</p>
                <button
                  onClick={() => onRestore(s)}
                  className="mt-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90"
                >
                  Reprendre
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Main POS ─── */
function POSPage() {
  const products   = useMBStore((s) => s.products);
  const categories = useMBStore((s) => s.categories);
  const customers  = useMBStore((s) => s.customers);
  const settings   = useMBStore((s) => s.settings);
  const addSale    = useMBStore((s) => s.addSale);
  const holdSale   = useMBStore((s) => s.holdSale);
  const releaseHeld = useMBStore((s) => s.releaseHeld);
  const heldSales  = useMBStore((s) => s.heldSales);
  const sales      = useMBStore((s) => s.sales);
  const session    = useAuthStore((s) => s.session);

  const [query, setQuery]           = useState("");
  const [activeCat, setActiveCat]   = useState<string>("all");
  const [items, setItems]           = useState<SaleItem[]>([]);
  const [customerId, setCustomerId] = useState<string>(customers[0]?.id ?? "");
  const [discount, setDiscount]     = useState<number>(0);
  const [taxPct, setTaxPct]         = useState<number>(settings.taxPct);
  const [payment, setPayment]       = useState<PaymentMethod>("cash");
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [weightModal, setWeightModal]   = useState<WeightModalState | null>(null);
  const [showHeldModal, setShowHeldModal] = useState(false);

  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => p.active)
      .filter((p) => activeCat === "all" || p.categoryId === activeCat)
      .filter((p) => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode?.toLowerCase().includes(q) ?? false);
      });
  }, [products, query, activeCat]);

  const subtotal = items.reduce((a, b) => a + b.subtotal, 0);
  const tax      = Math.round(((subtotal - discount) * taxPct) / 100);
  const total    = Math.max(0, subtotal - discount + tax);
  const change   = amountPaid > 0 ? amountPaid - total : 0;

  /* ─── Add piece product ─── */
  const addPieceProduct = (productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    if (p.stock <= 0) { toast.error("Pas de stock"); return; }
    setItems((prev) => {
      const existing = prev.find((x) => x.productId === productId);
      if (existing) {
        if (existing.quantity + 1 > p.stock) { toast.error("La quantité demandée est supérieure au stock"); return prev; }
        return prev.map((x) => x.productId === productId
          ? { ...x, quantity: x.quantity + 1, subtotal: (x.quantity + 1) * x.price } : x);
      }
      return [...prev, { productId: p.id, name: p.name, price: p.price, quantity: 1, subtotal: p.price, saleType: "piece" }];
    });
  };

  /* ─── Open weight modal ─── */
  const openWeightModal = (productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    if (p.stock <= 0) { toast.error("Pas de stock"); return; }
    setWeightModal({ product: p, inputVal: "" });
  };

  const handleAddProduct = (productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    if ((p.saleType ?? "piece") === "piece") addPieceProduct(productId);
    else openWeightModal(productId);
  };

  const confirmWeight = (qty: number) => {
    if (!weightModal) return;
    const p = weightModal.product;
    if (qty > p.stock) {
      toast.error(`Quantité (${qty} ${p.unit}) est supérieure au stock (${p.stock} ${p.unit})`);
      return;
    }
    const rQty = Math.round(qty * 1000) / 1000;
    const sub  = Math.round(p.price * rQty * 100) / 100;
    setItems((prev) => {
      const existing = prev.find((x) => x.productId === p.id);
      if (existing) {
        const newQty = Math.round((existing.quantity + rQty) * 1000) / 1000;
        if (newQty > p.stock) { toast.error("La quantité demandée est supérieure au stock"); return prev; }
        return prev.map((x) => x.productId === p.id
          ? { ...x, quantity: newQty, subtotal: Math.round(p.price * newQty * 100) / 100 } : x);
      }
      return [...prev, { productId: p.id, name: p.name, price: p.price, quantity: rQty, subtotal: sub, saleType: p.saleType, unit: p.unit }];
    });
    setWeightModal(null);
  };

  /* ─── Qty update ─── */
  const updateQty = (productId: string, delta: number) => {
    setItems((prev) => prev.map((x) => {
      if (x.productId !== productId) return x;
      const p = products.find((y) => y.id === productId);
      const nextQty = Math.round((x.quantity + delta) * 1000) / 1000;
      if (nextQty < 0) return x;
      if (p && nextQty > p.stock) { toast.error("Stock insuffisant"); return x; }
      return { ...x, quantity: nextQty, subtotal: Math.round(x.price * nextQty * 100) / 100 };
    }).filter((x) => x.quantity > 0));
  };

  const updateWeight = (productId: string, rawVal: string) => {
    const qty = parseFloat(rawVal);
    if (isNaN(qty) || qty < 0) return;
    const p = products.find((y) => y.id === productId);
    if (p && qty > p.stock) { toast.error("Stock insuffisant"); return; }
    const rQty = Math.round(qty * 1000) / 1000;
    setItems((prev) => prev.map((x) => x.productId === productId
      ? { ...x, quantity: rQty, subtotal: Math.round(x.price * rQty * 100) / 100 } : x
    ).filter((x) => x.quantity > 0));
  };

  const removeItem = (productId: string) => setItems((p) => p.filter((x) => x.productId !== productId));
  const clearCart  = () => { setItems([]); setDiscount(0); setAmountPaid(0); };

  /* ─── Restore held sale ─── */
  const restoreHeld = (sale: Sale) => {
    if (items.length > 0 && !confirm("La reprise de cette commande videra le panier actuel. Continuer ?")) return;
    releaseHeld(sale.id);
    setItems(sale.items);
    setDiscount(sale.discount);
    setTaxPct(sale.taxPct);
    setCustomerId(sale.customerId ?? "");
    setAmountPaid(0);
    setShowHeldModal(false);
    toast.success("Commande reprise");
  };

  const buildSale = (status: "completed" | "held"): Sale => {
    const customer = customers.find((c) => c.id === customerId);
    return {
      id: crypto.randomUUID(),
      invoiceNumber: nextInvoiceNumber(sales),
      customerId: customer?.id,
      customerName: customer?.name ?? "Walk-in Customer",
      items, subtotal, discount, taxPct, total, payment, status,
      cashierId: session?.userId ?? "unknown",
      createdAt: new Date().toISOString(),
    };
  };

  const complete = (print: boolean) => {
    if (items.length === 0) { toast.error("Panier vide"); return; }
    if (amountPaid > 0 && amountPaid < total) { toast.error("Montant payé inférieur au total"); return; }
    const sale = buildSale("completed");
    addSale(sale);
    toast.success(`Vente terminée — ${sale.invoiceNumber}`);
    if (print) void printSaleReceipt(sale, settings, session?.displayName ?? "—", amountPaid > 0 ? amountPaid : undefined);
    clearCart();
  };

  const hold = () => {
    if (items.length === 0) return;
    holdSale(buildSale("held"));
    toast.success("Vente mise en attente");
    clearCart();
  };

  return (
    <>
      {weightModal && (
        <WeightModal state={weightModal} currency={settings.currency} onConfirm={confirmWeight} onClose={() => setWeightModal(null)} />
      )}
      {showHeldModal && (
        <HeldSalesModal heldSales={heldSales} currency={settings.currency} onRestore={restoreHeld} onClose={() => setShowHeldModal(false)} />
      )}

      <div className="grid h-screen grid-cols-1 lg:grid-cols-[1fr_420px]" dir="ltr">
        {/* Products area */}
        <div className="flex min-h-0 flex-col overflow-hidden">
          <div className="border-b bg-card p-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher par nom ou scanner le code-barres..."
                className="w-full rounded-2xl border-2 border-warning/60 bg-background pr-10 pl-11 py-3 text-sm outline-none focus:border-primary"
                autoFocus
              />
              <button className="absolute left-2 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent">
                <ScanLine className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              <CatChip active={activeCat === "all"} onClick={() => setActiveCat("all")} label="Tout" />
              {categories.filter((c) => c.active).map((c) => (
                <CatChip key={c.id} active={activeCat === c.id} onClick={() => setActiveCat(c.id)} label={c.name} />
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {filteredProducts.map((p) => {
                const isMeasured = p.saleType && p.saleType !== "piece";
                return (
                  <button
                    key={p.id} onClick={() => handleAddProduct(p.id)}
                    className="group relative overflow-hidden rounded-2xl border bg-card text-right shadow-card transition hover:-translate-y-0.5 hover:shadow-elevated"
                  >
                    <div className="relative aspect-square overflow-hidden bg-muted">
                      {p.image
                        ? <img src={p.image} alt={p.name} className="h-full w-full object-cover transition group-hover:scale-105" />
                        : <div className="flex h-full w-full items-center justify-center text-4xl text-muted-foreground">📦</div>
                      }
                      <span className={`absolute top-2 left-2 rounded-full px-2 py-0.5 text-xs font-bold text-white ${p.stock <= p.minStock ? "bg-destructive" : "bg-warning"}`}>
                        {p.stock}{isMeasured ? ` ${p.unit}` : ""}
                      </span>
                      {isMeasured && (
                        <span className="absolute bottom-1 right-1 rounded-full bg-info/80 px-1.5 py-0.5 text-[10px] font-bold text-white flex items-center gap-0.5">
                          <Scale className="h-2.5 w-2.5" /> {p.unit}
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="font-semibold text-sm truncate">{p.name}</p>
                      <p className="mt-1 text-[11px] font-mono text-muted-foreground truncate">{p.sku}</p>
                      <p className="mt-2 text-lg font-extrabold text-primary">
                        {formatMoney(p.price, settings.currency)}
                        {isMeasured && <span className="text-xs font-medium text-muted-foreground">/{p.unit}</span>}
                      </p>
                    </div>
                  </button>
                );
              })}
              {filteredProducts.length === 0 && (
                <div className="col-span-full p-16 text-center text-sm text-muted-foreground">Aucun produit trouvé</div>
              )}
            </div>
          </div>
        </div>

        {/* Cart */}
        <aside className="flex min-h-0 flex-col border-r bg-card">
          {/* Customer + held sales button */}
          <div className="border-b p-3 space-y-2">
            <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2">
              <UserPlus className="h-4 w-4 text-muted-foreground" />
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="flex-1 bg-transparent text-sm outline-none">
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button
              onClick={() => setShowHeldModal(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-warning/40 bg-warning/5 py-2 text-xs font-semibold text-warning hover:bg-warning/10"
            >
              <History className="h-3.5 w-3.5" />
              Ventes en attente
              {heldSales.length > 0 && (
                <span className="rounded-full bg-warning text-white px-1.5 py-0.5 text-[10px] font-bold">{heldSales.length}</span>
              )}
            </button>
          </div>

          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-bold">Panier</p>
            <p className="text-xs text-muted-foreground">{items.length} produit</p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                <div className="grid h-16 w-16 place-items-center rounded-full bg-muted">
                  <Trash2 className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="mt-4 text-lg font-bold">Panier vide</p>
                <p className="text-xs text-muted-foreground">Scannez le code-barres ou choisissez un produit</p>
              </div>
            ) : (
              <ul className="divide-y">
                {items.map((it) => {
                  const isMeasured = it.saleType && it.saleType !== "piece";
                  return (
                    <li key={it.productId} className="flex items-center gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{it.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatMoney(it.price, settings.currency)}{isMeasured ? `/${it.unit}` : ""}
                        </p>
                      </div>
                      {isMeasured ? (
                        <div className="flex items-center gap-1 rounded-lg border px-2 py-1">
                          <input
                            type="number" step="0.001" min="0.001" value={it.quantity}
                            onChange={(e) => updateWeight(it.productId, e.target.value)}
                            className="w-16 bg-transparent text-center text-sm font-bold outline-none"
                          />
                          <span className="text-xs text-muted-foreground">{it.unit}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 rounded-lg border">
                          <button onClick={() => updateQty(it.productId, -1)} className="grid h-7 w-7 place-items-center hover:bg-accent"><Minus className="h-3.5 w-3.5" /></button>
                          <span className="w-8 text-center text-sm font-bold">{it.quantity}</span>
                          <button onClick={() => updateQty(it.productId, 1)} className="grid h-7 w-7 place-items-center hover:bg-accent"><Plus className="h-3.5 w-3.5" /></button>
                        </div>
                      )}
                      <p className="w-20 text-left text-sm font-bold">{formatMoney(it.subtotal, settings.currency)}</p>
                      <button onClick={() => removeItem(it.productId)} className="grid h-7 w-7 place-items-center text-destructive hover:bg-destructive/10 rounded-lg">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Totals + payment */}
          <div className="border-t p-4 space-y-2 text-sm">
            <Row label="Sous-total" value={formatMoney(subtotal, settings.currency)} />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Remise</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{settings.currency}</span>
                <input type="number" value={discount}
                  onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                  className="w-20 rounded-lg border bg-background px-2 py-1 text-right text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="w-16 text-left font-medium text-destructive">- {formatMoney(discount, settings.currency)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Taxe (%)</span>
              <div className="flex items-center gap-2">
                <input type="number" value={taxPct}
                  onChange={(e) => setTaxPct(Math.max(0, Number(e.target.value)))}
                  className="w-16 rounded-lg border bg-background px-2 py-1 text-right text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="text-xs">%</span>
                <span className="w-16 text-left font-medium">{formatMoney(Math.round(((subtotal - discount) * taxPct) / 100), settings.currency)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between border-t pt-3 text-lg font-extrabold">
              <span>Total</span>
              <span className="text-primary">{formatMoney(total, settings.currency)}</span>
            </div>

            {/* Amount paid + change */}
            <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">Montant payé</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">{settings.currency}</span>
                  <input
                    type="number" min="0" step="1"
                    value={amountPaid || ""}
                    onChange={(e) => setAmountPaid(Math.max(0, Number(e.target.value)))}
                    placeholder={String(total)}
                    className="w-24 rounded-lg border bg-background px-2 py-1.5 text-right text-sm font-bold outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              {amountPaid > 0 && (
                <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                  change >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                }`}>
                  <span className="font-semibold text-sm">{change >= 0 ? "Monnaie" : "Reste à payer"}</span>
                  <span className="font-extrabold text-base">{formatMoney(Math.abs(change), settings.currency)}</span>
                </div>
              )}
            </div>

            <p className="pt-1 text-xs font-semibold text-muted-foreground">Mode de paiement</p>
            <div className="grid grid-cols-4 gap-2">
              {([
                { m: "cash",     label: "Espèces",    Icon: Banknote },
                { m: "card",     label: "Carte",    Icon: CreditCard },
                { m: "mobile",   label: "Mobile",   Icon: Smartphone },
                { m: "transfer", label: "Virement",    Icon: ArrowLeftRight },
              ] as const).map(({ m, label, Icon }) => (
                <button key={m} onClick={() => setPayment(m)}
                  className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs font-semibold transition ${
                    payment === m ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"
                  }`}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button onClick={clearCart} className="flex items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" /> Effacer
              </button>
              <button onClick={hold} className="flex items-center justify-center gap-2 rounded-xl border bg-muted/40 py-2.5 text-sm font-semibold hover:bg-accent">
                <Pause className="h-4 w-4" /> Attente
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => complete(true)} className="flex items-center justify-center gap-2 rounded-xl bg-success py-3 text-sm font-bold text-success-foreground hover:opacity-90">
                <Printer className="h-4 w-4" /> Payer + Imprimer
              </button>
              <button onClick={() => complete(false)} className="flex items-center justify-center gap-2 rounded-xl bg-info py-3 text-sm font-bold text-info-foreground hover:opacity-90">
                <CheckCircle2 className="h-4 w-4" /> Payer + Terminer
              </button>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
function CatChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition ${
        active ? "bg-primary text-primary-foreground shadow-primary" : "bg-muted hover:bg-accent"
      }`}
    >
      {label}
    </button>
  );
}
