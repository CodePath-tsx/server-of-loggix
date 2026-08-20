import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Trash2, Receipt, Package, Printer, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import {
  useMBStore, formatMoney,
  type Expense, type ExpenseType,
  type BonDeCommande, type BonDeCommandeItem,
} from "@/lib/mb-store";
import { printBonDeCommande } from "@/lib/print";
import { PageBody, PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/_app/expenses")({ component: ExpensesPage });

function ExpensesPage() {
  const expenses   = useMBStore((s) => s.expenses);
  const currency   = useMBStore((s) => s.settings.currency);
  const company    = useMBStore((s) => s.settings);
  const taxPct     = useMBStore((s) => s.settings.taxPct);
  const add        = useMBStore((s) => s.addExpense);
  const remove     = useMBStore((s) => s.removeExpense);
  const [tab, setTab] = useState<"all" | ExpenseType>("all");
  const [open, setOpen]   = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => expenses.filter((e) => tab === "all" || e.type === tab), [expenses, tab]);
  const total    = expenses.reduce((a, b) => a + b.amount, 0);
  const product  = expenses.filter((e) => e.type === "product").reduce((a, b) => a + b.amount, 0);
  const other    = expenses.filter((e) => e.type === "other").reduce((a, b) => a + b.amount, 0);
  const monthDays = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();

  return (
    <PageBody>
      <PageHeader
        title="Dépenses"
        description="Suivi des dépenses produits et opérationnelles"
        actions={
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-primary hover:bg-primary-hover"
          >
            <Plus className="h-4 w-4" /> Ajouter une dépense
          </button>
        }
      />

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <BigCard label="Total des dépenses"   value={formatMoney(total, currency)}             color="text-foreground" />
        <BigCard label="Dépenses produits"    value={formatMoney(product, currency)}           color="text-info" />
        <BigCard label="Autres dépenses"        value={formatMoney(other, currency)}             color="text-warning" />
        <BigCard label="Moyenne journalière"       value={formatMoney(total / monthDays, currency)} color="text-primary" />
      </div>

      <div className="rounded-2xl border bg-card p-2 shadow-card flex gap-2">
        {(["all", "product", "other"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold ${tab === t ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground"}`}
          >
            {t === "all" ? "Tout" : t === "product" ? "Dépenses produits" : "Autres dépenses"}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <div className="border-b p-4 text-sm">
          Affichage <span className="font-bold">{filtered.length}</span> résultat
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-4 text-right">Date</th>
              <th className="p-4 text-right">Type</th>
              <th className="p-4 text-right">Description</th>
              <th className="p-4 text-right">Montant</th>
              <th className="p-4 text-right">Référence BC</th>
              <th className="p-4 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((e) => (
              <ExpenseRow
                key={e.id}
                expense={e}
                currency={currency}
                expanded={expanded === e.id}
                onExpand={() => setExpanded(expanded === e.id ? null : e.id)}
                onPrint={() => printBonDeCommande(e.bonDeCommande!, company as any)}
                onDelete={() => { remove(e.id); toast.success("Supprimé"); }}
              />
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="p-12 text-center text-muted-foreground">Aucune dépense</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <AddDialog
          defaultTaxPct={taxPct}
          onClose={() => setOpen(false)}
          onAdd={(e) => { add(e); setOpen(false); toast.success("Ajouté"); }}
        />
      )}
    </PageBody>
  );
}

/* ── Expense table row (+ optional BDC detail row) ── */
function ExpenseRow({
  expense: e,
  currency,
  expanded,
  onExpand,
  onPrint,
  onDelete,
}: {
  expense: Expense;
  currency: string;
  expanded: boolean;
  onExpand: () => void;
  onPrint: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <tr className="hover:bg-muted/20">
        <td className="p-4 font-bold">{new Date(e.createdAt).toLocaleDateString("fr-FR")}</td>
        <td className="p-4">
          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold uppercase ${e.type === "product" ? "bg-info/10 text-info" : "bg-warning/15 text-warning"}`}>
            {e.type === "product" ? <Package className="h-3 w-3" /> : <Receipt className="h-3 w-3" />}
            {e.type === "product" ? "Produits" : "Autre"}
          </span>
        </td>
        <td className="p-4 font-semibold">{e.description}</td>
        <td className="p-4 text-lg font-extrabold">{formatMoney(e.amount, currency)}</td>
        <td className="p-4">
          {e.bonDeCommande
            ? <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary"><FileText className="h-3 w-3" />{e.bonDeCommande.number}</span>
            : <span className="text-muted-foreground">—</span>}
        </td>
        <td className="p-4 flex gap-1">
          {e.bonDeCommande && (
            <>
              <button onClick={onPrint} className="grid h-8 w-8 place-items-center rounded-lg text-primary hover:bg-primary/10" title="Imprimer Bon de Commande">
                <Printer className="h-4 w-4" />
              </button>
              <button onClick={onExpand} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent" title="Voir les détails">
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </>
          )}
          <button onClick={onDelete} className="grid h-8 w-8 place-items-center rounded-lg text-destructive hover:bg-destructive/10">
            <Trash2 className="h-4 w-4" />
          </button>
        </td>
      </tr>
      {expanded && e.bonDeCommande && (
        <tr>
          <td colSpan={6} className="bg-muted/20 px-6 py-4">
            <BdcDetail bdc={e.bonDeCommande} currency={currency} />
          </td>
        </tr>
      )}
    </>
  );
}

/* ── Bon de Commande detail inline view ── */
function BdcDetail({ bdc, currency }: { bdc: BonDeCommande; currency: string }) {
  const money = (v: number) => formatMoney(v, currency);
  return (
    <div dir="ltr" className="text-xs space-y-3">
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div><span className="text-muted-foreground">Fournisseur:</span> <strong>{bdc.supplierName}</strong></div>
        {bdc.supplierPhone && <div><span className="text-muted-foreground">Tél:</span> <strong>{bdc.supplierPhone}</strong></div>}
        {bdc.supplierAddress && <div><span className="text-muted-foreground">Adresse:</span> <strong>{bdc.supplierAddress}</strong></div>}
      </div>
      <table className="w-full border-collapse rounded-xl overflow-hidden">
        <thead className="bg-muted text-muted-foreground text-xs uppercase">
          <tr>
            <th className="p-2 text-center">Qté</th>
            <th className="p-2 text-center">Unité</th>
            <th className="p-2 text-left">Description</th>
            <th className="p-2 text-right">Prix U.</th>
            <th className="p-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {bdc.items.map((it, i) => (
            <tr key={i} className="hover:bg-muted/20">
              <td className="p-2 text-center">{it.quantity}</td>
              <td className="p-2 text-center">{it.unit}</td>
              <td className="p-2">{it.description}</td>
              <td className="p-2 text-right">{money(it.unitPrice)}</td>
              <td className="p-2 text-right font-bold">{money(it.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-end gap-8 text-sm font-semibold">
        <span>Sous-total: {money(bdc.subtotal)}</span>
        {bdc.shipping > 0 && <span>Transport: {money(bdc.shipping)}</span>}
        <span>TVA ({bdc.taxPct}%): {money(bdc.tax)}</span>
        <span className="text-base font-extrabold">TOTAL: {money(bdc.total)}</span>
      </div>
    </div>
  );
}

/* ── BigCard ── */
function BigCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-card">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-3 text-3xl font-extrabold ${color}`}>{value}</p>
    </div>
  );
}

/* ── Add dialog (simple + bon de commande) ── */
function AddDialog({
  defaultTaxPct,
  onClose,
  onAdd,
}: {
  defaultTaxPct: number;
  onClose: () => void;
  onAdd: (e: Expense) => void;
}) {
  const [type, setType]           = useState<ExpenseType>("other");
  const [desc, setDesc]           = useState("");
  const [amount, setAmount]       = useState(0);
  const [withBdc, setWithBdc]     = useState(false);

  // BDC fields
  const [bdcNumber, setBdcNumber]           = useState(`BC-${Date.now().toString().slice(-6)}`);
  const [supplierName, setSupplierName]     = useState("");
  const [supplierPhone, setSupplierPhone]   = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryCity, setDeliveryCity]     = useState("");
  const [shipping, setShipping]             = useState(0);
  const [taxPct, setTaxPct]                 = useState(defaultTaxPct);
  const [conditions, setConditions]         = useState("");
  const [authorizedBy, setAuthorizedBy]     = useState("");
  const [items, setItems] = useState<BonDeCommandeItem[]>([
    { description: "", quantity: 1, unit: "pcs", unitPrice: 0, total: 0 },
  ]);

  const updateItem = (i: number, field: keyof BonDeCommandeItem, val: string | number) => {
    setItems((prev) => {
      const next = [...prev];
      const it = { ...next[i], [field]: val };
      if (field === "quantity" || field === "unitPrice") {
        it.total = Math.round((Number(it.quantity) * Number(it.unitPrice)) * 100) / 100;
      }
      next[i] = it;
      return next;
    });
  };

  const addItem = () =>
    setItems((prev) => [...prev, { description: "", quantity: 1, unit: "pcs", unitPrice: 0, total: 0 }]);
  const removeItem = (i: number) =>
    setItems((prev) => prev.filter((_, idx) => idx !== i));

  const itemsSubtotal = items.reduce((a, it) => a + it.total, 0);
  const taxAmt        = Math.round((itemsSubtotal + shipping) * taxPct) / 100;
  const bdcTotal      = itemsSubtotal + shipping + taxAmt;

  const handleSave = () => {
    if (!desc) { toast.error("Veuillez entrer une description"); return; }
    if (!withBdc && amount <= 0) { toast.error("Veuillez entrer un montant valide"); return; }
    if (withBdc && !supplierName) { toast.error("Veuillez entrer le nom du fournisseur"); return; }
    if (withBdc && items.length === 0) { toast.error("Veuillez ajouter au moins un article"); return; }

    let bdc: BonDeCommande | undefined;
    if (withBdc) {
      // Sanitise all numeric inputs to prevent NaN in persisted data
      const safeItems = items.map((it) => ({
        ...it,
        quantity: Number.isFinite(it.quantity) ? it.quantity : 1,
        unitPrice: Number.isFinite(it.unitPrice) ? it.unitPrice : 0,
        total: Number.isFinite(it.total) ? it.total : 0,
      }));
      const safeSubtotal  = safeItems.reduce((a, it) => a + it.total, 0);
      const safeShipping  = Number.isFinite(shipping) ? shipping : 0;
      const safeTaxPct    = Number.isFinite(taxPct) ? taxPct : 0;
      const safeTax       = Math.round((safeSubtotal + safeShipping) * safeTaxPct) / 100;
      const safeTotal     = safeSubtotal + safeShipping + safeTax;
      bdc = {
        number: bdcNumber,
        supplierName,
        supplierPhone,
        supplierAddress,
        deliveryAddress,
        deliveryCity,
        items: safeItems,
        subtotal: safeSubtotal,
        shipping: safeShipping,
        taxPct: safeTaxPct,
        tax: safeTax,
        total: safeTotal,
        conditions,
        authorizedBy,
      };
    }

    onAdd({
      id: crypto.randomUUID(),
      type,
      description: desc,
      amount: withBdc ? (bdc!.total > 0 ? bdc!.total : amount) : amount,
      bonDeCommande: bdc,
      createdAt: new Date().toISOString(),
    });
  };

  const inputCls = "w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div
        className="mx-auto my-8 w-full max-w-2xl rounded-2xl bg-card p-6 shadow-elevated"
        onClick={(e) => e.stopPropagation()}
        dir="ltr"
      >
        <h2 className="text-xl font-bold mb-5">Ajouter une dépense</h2>

        {/* Type */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {(["other", "product"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`rounded-xl border py-2.5 text-sm font-semibold transition ${type === t ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"}`}
            >
              {t === "product" ? "Dépense produit" : "Autre dépense"}
            </button>
          ))}
        </div>

        {/* Basic fields */}
        <div className="space-y-3 mb-4">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Description *</span>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} className={`mt-1 ${inputCls}`} placeholder="Description de la dépense" />
          </label>
          {!withBdc && (
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Montant *</span>
              <input type="number" value={amount} onChange={(e) => setAmount(+e.target.value)} className={`mt-1 ${inputCls}`} min="0" step="0.01" />
            </label>
          )}
        </div>

        {/* Toggle BDC */}
        <label className="flex items-center gap-2 text-sm font-semibold mb-4 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={withBdc}
            onChange={(e) => setWithBdc(e.target.checked)}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          <FileText className="h-4 w-4 text-primary" />
          Créer Bon de Commande
        </label>

        {withBdc && (
          <div className="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-4" dir="ltr">
            <div className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Bon de Commande</div>

            {/* BDC header info */}
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-muted-foreground">N° Bon de Commande</span>
                <input value={bdcNumber} onChange={(e) => setBdcNumber(e.target.value)} className={`mt-1 ${inputCls}`} />
              </label>
              <label className="block">
                <span className="text-xs text-muted-foreground">TVA %</span>
                <input type="number" value={taxPct} onChange={(e) => setTaxPct(+e.target.value)} className={`mt-1 ${inputCls}`} min="0" max="100" />
              </label>
            </div>

            {/* Supplier */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fournisseur</div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-muted-foreground">Nom *</span>
                  <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className={`mt-1 ${inputCls}`} placeholder="Nom du fournisseur" />
                </label>
                <label className="block">
                  <span className="text-xs text-muted-foreground">Téléphone</span>
                  <input value={supplierPhone} onChange={(e) => setSupplierPhone(e.target.value)} className={`mt-1 ${inputCls}`} />
                </label>
              </div>
              <label className="block">
                <span className="text-xs text-muted-foreground">Adresse</span>
                <input value={supplierAddress} onChange={(e) => setSupplierAddress(e.target.value)} className={`mt-1 ${inputCls}`} />
              </label>
            </div>

            {/* Delivery */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Adresse de livraison</div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-muted-foreground">Adresse</span>
                  <input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} className={`mt-1 ${inputCls}`} />
                </label>
                <label className="block">
                  <span className="text-xs text-muted-foreground">Ville</span>
                  <input value={deliveryCity} onChange={(e) => setDeliveryCity(e.target.value)} className={`mt-1 ${inputCls}`} />
                </label>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Articles</div>
                <button onClick={addItem} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
                  <Plus className="h-3 w-3" /> Ajouter
                </button>
              </div>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 text-muted-foreground">
                    <tr>
                      <th className="p-2 text-center w-16">Qté</th>
                      <th className="p-2 text-center w-20">Unité</th>
                      <th className="p-2 text-left">Description</th>
                      <th className="p-2 text-right w-28">Prix U.</th>
                      <th className="p-2 text-right w-28">Total</th>
                      <th className="p-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((it, i) => (
                      <tr key={i}>
                        <td className="p-1">
                          <input type="number" value={it.quantity} min="1" step="1" onChange={(e) => updateItem(i, "quantity", +e.target.value)}
                            className="w-full rounded-lg border bg-background px-2 py-1 text-center text-xs" />
                        </td>
                        <td className="p-1">
                          <input value={it.unit} onChange={(e) => updateItem(i, "unit", e.target.value)}
                            className="w-full rounded-lg border bg-background px-2 py-1 text-center text-xs" />
                        </td>
                        <td className="p-1">
                          <input value={it.description} onChange={(e) => updateItem(i, "description", e.target.value)}
                            className="w-full rounded-lg border bg-background px-2 py-1 text-xs" placeholder="Description de l'article" />
                        </td>
                        <td className="p-1">
                          <input type="number" value={it.unitPrice} min="0" step="0.01" onChange={(e) => updateItem(i, "unitPrice", +e.target.value)}
                            className="w-full rounded-lg border bg-background px-2 py-1 text-right text-xs" />
                        </td>
                        <td className="p-2 text-right font-bold">{it.total.toLocaleString()}</td>
                        <td className="p-1">
                          <button onClick={() => removeItem(i)} className="grid h-6 w-6 place-items-center rounded text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Transport + totals */}
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-muted-foreground">Transport / Frais d'expédition</span>
                <input type="number" value={shipping} min="0" step="0.01" onChange={(e) => setShipping(+e.target.value)} className={`mt-1 ${inputCls}`} />
              </label>
              <div className="rounded-xl border bg-background p-3 text-xs space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Sous-total</span><span className="font-semibold">{itemsSubtotal.toLocaleString()}</span></div>
                {shipping > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Transport</span><span className="font-semibold">{shipping.toLocaleString()}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">TVA ({taxPct}%)</span><span className="font-semibold">{taxAmt.toLocaleString()}</span></div>
                <div className="flex justify-between border-t pt-1 text-sm font-extrabold"><span>TOTAL</span><span>{bdcTotal.toLocaleString()}</span></div>
              </div>
            </div>

            {/* Conditions + authorized */}
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-muted-foreground">Conditions et modalités</span>
                <textarea value={conditions} onChange={(e) => setConditions(e.target.value)}
                  rows={2} className={`mt-1 ${inputCls} resize-none`} />
              </label>
              <label className="block">
                <span className="text-xs text-muted-foreground">Autorisé par</span>
                <input value={authorizedBy} onChange={(e) => setAuthorizedBy(e.target.value)} className={`mt-1 ${inputCls}`} />
              </label>
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border px-5 py-2.5 text-sm font-medium">Annuler</button>
          <button onClick={handleSave} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
