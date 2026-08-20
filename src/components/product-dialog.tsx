import { useEffect, useState } from "react";
import { X, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useMBStore, type Product, type SaleType, SALE_TYPE_LABELS, UNIT_OPTIONS } from "@/lib/mb-store";
import { generateEAN13, makeBarcodeDataUrl } from "@/lib/print";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  product: Product | null;
}

export function ProductDialog({ open, onOpenChange, product }: Props) {
  const upsert = useMBStore((s) => s.upsertProduct);
  const categories = useMBStore((s) => s.categories);

  const [form, setForm] = useState<Product>(() => empty());
  const [preview, setPreview] = useState<string>("");

  useEffect(() => {
    const base = product ?? empty();
    if (!product && !base.barcode) base.barcode = generateEAN13();
    setForm(base);
  }, [product, open]);

  useEffect(() => {
    let alive = true;
    const code = (form.barcode ?? "").trim();
    if (!code) { setPreview(""); return; }
    const isEan13 = /^\d{13}$/.test(code);
    makeBarcodeDataUrl(code, { format: isEan13 ? "EAN13" : "CODE128", height: 40, width: 1.8, displayValue: true })
      .then((u) => { if (alive) setPreview(u); })
      .catch(() => { if (alive) setPreview(""); });
    return () => { alive = false; };
  }, [form.barcode]);

  if (!open) return null;

  const saleType = form.saleType ?? "piece";
  const isMeasured = saleType !== "piece";

  const availableUnits = UNIT_OPTIONS.filter((u) => u.types.includes(saleType as SaleType));

  const setSaleType = (t: SaleType) => {
    const defaultUnit = UNIT_OPTIONS.find((u) => u.types.includes(t))?.value;
    setForm((p) => ({ ...p, saleType: t, unit: t === "piece" ? undefined : (defaultUnit ?? p.unit) }));
  };

  const save = () => {
    if (!form.name.trim()) return toast.error("Entrez le nom du produit");
    if (!form.sku.trim()) return toast.error("Entrez le SKU");
    if (isMeasured && !form.unit) return toast.error("Sélectionnez l'unité de mesure");
    const barcode = form.barcode?.trim() || generateEAN13();
    upsert({ ...form, barcode, createdAt: form.createdAt || new Date().toISOString() });
    toast.success(product ? "Mis à jour" : "Ajouté");
    onOpenChange(false);
  };

  const regenBarcode = () => setForm((p) => ({ ...p, barcode: generateEAN13() }));

  const onImage = (f: File | null) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setForm((p) => ({ ...p, image: String(r.result) }));
    r.readAsDataURL(f);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => onOpenChange(false)}>
      <div className="w-full max-w-2xl rounded-2xl bg-card shadow-elevated" onClick={(e) => e.stopPropagation()} dir="ltr">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-bold">{product ? "Modifier le produit" : "Ajouter un produit"}</h2>
          <button onClick={() => onOpenChange(false)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 grid gap-4 md:grid-cols-2 max-h-[70vh] overflow-y-auto">
          <Field label="Nom"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inp} /></Field>
          <Field label="SKU"><input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className={inp} /></Field>

          {/* Sale Type */}
          <div className="md:col-span-2">
            <Field label="Mode de vente">
              <div className="flex flex-wrap gap-2 mt-1">
                {(Object.keys(SALE_TYPE_LABELS) as SaleType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSaleType(t)}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                      saleType === t
                        ? "border-primary bg-primary text-primary-foreground"
                        : "hover:bg-accent"
                    }`}
                  >
                    {SALE_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          {/* Unit selector — only shown for measured types */}
          {isMeasured && (
            <div className="md:col-span-2">
              <Field label="Unité de mesure">
                <div className="flex flex-wrap gap-2 mt-1">
                  {availableUnits.map((u) => (
                    <button
                      key={u.value}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, unit: u.value }))}
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                        form.unit === u.value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "hover:bg-accent"
                      }`}
                    >
                      {u.label}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          )}

          <div className="md:col-span-2">
            <Field label="Barcode">
              <div className="flex items-center gap-2">
                <input
                  value={form.barcode ?? ""}
                  onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                  className={inp}
                  placeholder="Le code-barres EAN-13 sera généré automatiquement"
                />
                <button
                  type="button"
                  onClick={regenBarcode}
                  className="flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-semibold hover:bg-accent"
                  title="Générer un nouveau code-barres"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Générer
                </button>
              </div>
              {preview && (
                <div className="mt-2 flex items-center justify-center rounded-xl border bg-white p-2">
                  <img src={preview} alt="barcode preview" className="h-14" />
                </div>
              )}
            </Field>
          </div>

          <Field label="Catégorie">
            <select value={form.categoryId ?? ""} onChange={(e) => setForm({ ...form, categoryId: e.target.value || undefined })} className={inp}>
              <option value="">—</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Prix de revient"><input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: +e.target.value })} className={inp} /></Field>
          <Field label={isMeasured ? `Prix unitaire (${form.unit ?? "—"})` : "Prix de vente"}>
            <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: +e.target.value })} className={inp} />
          </Field>
          <Field label={isMeasured ? `Stock (${form.unit ?? "—"})` : "Quantité"}>
            <input type="number" step={isMeasured ? "0.001" : "1"} value={form.stock} onChange={(e) => setForm({ ...form, stock: +e.target.value })} className={inp} />
          </Field>
          <Field label={isMeasured ? `Minimum (${form.unit ?? "—"})` : "Stock minimum"}>
            <input type="number" step={isMeasured ? "0.001" : "1"} value={form.minStock} onChange={(e) => setForm({ ...form, minStock: +e.target.value })} className={inp} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Description"><textarea rows={2} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inp} /></Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Image">
              <div className="flex items-center gap-3">
                {form.image && <img src={form.image} alt="" className="h-16 w-16 rounded-xl object-cover" />}
                <input type="file" accept="image/*" onChange={(e) => onImage(e.target.files?.[0] ?? null)} className="text-sm" />
              </div>
            </Field>
          </div>
          <label className="md:col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            Actif
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t p-4">
          <button onClick={() => onOpenChange(false)} className="rounded-xl border px-4 py-2 text-sm hover:bg-accent">Annuler</button>
          <button onClick={save} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

const inp = "w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs font-medium text-muted-foreground">{label}</span><div className="mt-1">{children}</div></label>;
}
function empty(): Product {
  return {
    id: crypto.randomUUID(),
    name: "", sku: "", cost: 0, price: 0, stock: 0, minStock: 5,
    active: true, createdAt: "",
    saleType: "piece",
  };
}
