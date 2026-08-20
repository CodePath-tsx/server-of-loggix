import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, Printer } from "lucide-react";
import { toast } from "sonner";
import { useMBStore, formatMoney, type Product } from "@/lib/mb-store";
import { PageBody, PageHeader } from "@/components/app-shell";
import { ProductDialog } from "@/components/product-dialog";
import { printProductLabel } from "@/lib/print";


export const Route = createFileRoute("/_app/products")({
  component: ProductsPage,
});

function ProductsPage() {
  const products = useMBStore((s) => s.products);
  const categories = useMBStore((s) => s.categories);
  const currency = useMBStore((s) => s.settings.currency);
  const settings = useMBStore((s) => s.settings);
  const removeProduct = useMBStore((s) => s.removeProduct);


  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => products.filter((p) => {
    if (cat !== "all" && p.categoryId !== cat) return false;
    if (status === "active" && !p.active) return false;
    if (status === "inactive" && p.active) return false;
    if (q && !(p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  }), [products, q, cat, status]);

  return (
    <PageBody>
      <PageHeader
        title="Products"
        description="Manage your product catalog"
        actions={
          <button
            onClick={() => { setEditing(null); setOpen(true); }}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-primary hover:bg-primary-hover"
          >
            <Plus className="h-4 w-4" /> Add Product
          </button>
        }
      />

      <div className="rounded-2xl border bg-card p-4 shadow-card">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, SKU, barcode..." className="w-full rounded-xl border bg-background pr-9 pl-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded-xl border bg-background px-3 py-2.5 text-sm outline-none">
            <option value="all">All Categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border bg-background px-3 py-2.5 text-sm outline-none">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <div className="flex items-center justify-between border-b p-4">
          <p className="text-sm">Showing <span className="font-bold">{filtered.length}</span> products</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-4 text-right">Image</th>
                <th className="p-4 text-right">Product Info</th>
                <th className="p-4 text-right">Category</th>
                <th className="p-4 text-right">Cost</th>
                <th className="p-4 text-right">Price</th>
                <th className="p-4 text-right">Stock</th>
                <th className="p-4 text-right">Status</th>
                <th className="p-4 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((p) => {
                const c = categories.find((x) => x.id === p.categoryId);
                return (
                  <tr key={p.id} className="hover:bg-muted/20">
                    <td className="p-4">
                      <div className="h-12 w-12 overflow-hidden rounded-xl bg-muted">
                        {p.image ? <img src={p.image} alt={p.name} className="h-full w-full object-cover" /> : null}
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="font-bold">{p.name}</p>
                      <p className="text-xs font-mono text-muted-foreground">{p.sku}</p>
                    </td>
                    <td className="p-4">
                      {c ? <span className="rounded-lg bg-muted px-2 py-1 text-xs font-semibold">{c.name}</span> : "—"}
                    </td>
                    <td className="p-4 text-muted-foreground">{formatMoney(p.cost, currency)}</td>
                    <td className="p-4 font-bold">{formatMoney(p.price, currency)}</td>
                    <td className="p-4">
                      <span className={`rounded-lg px-2 py-1 text-xs font-semibold ${p.stock > p.minStock ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive"}`}>
                        {p.stock} in stock
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold ${p.active ? "text-success" : "text-muted-foreground"}`}>
                        ● {p.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setEditing(p); setOpen(true); }} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent" aria-label="Edit">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            const n = parseInt(prompt("Nombre d'étiquettes à imprimer ?", "6") ?? "0", 10);
                            if (!n || n < 1) return;
                            printProductLabel(p, settings, n).catch(() => toast.error("Échec de l'impression"));
                          }}
                          className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent"
                          aria-label="Print label"
                          title="Imprimer l'étiquette code-barres"
                        >
                          <Printer className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => {
                            if (confirm(`Supprimer ${p.name} ?`)) {
                              removeProduct(p.id);
                              toast.success("Supprimé avec succès");
                            }
                          }}
                          className="grid h-8 w-8 place-items-center rounded-lg text-destructive hover:bg-destructive/10"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="p-12 text-center text-muted-foreground">Aucun produit</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ProductDialog open={open} onOpenChange={setOpen} product={editing} />
    </PageBody>
  );
}
