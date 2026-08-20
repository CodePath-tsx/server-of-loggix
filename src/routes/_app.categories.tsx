import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, Trash2, Folder, FolderCheck, Package, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useMBStore, type Category } from "@/lib/mb-store";
import { PageBody, PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/_app/categories")({ component: CategoriesPage });

function CategoriesPage() {
  const cats = useMBStore((s) => s.categories);
  const products = useMBStore((s) => s.products);
  const upsert = useMBStore((s) => s.upsertCategory);
  const remove = useMBStore((s) => s.removeCategory);
  const [editing, setEditing] = useState<Category | null>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const stats = [
    { label: "Total Categories", value: cats.length, Icon: Folder, color: "bg-primary/10 text-primary" },
    { label: "Active Categories", value: cats.filter((c) => c.active).length, Icon: FolderCheck, color: "bg-success/10 text-success" },
    { label: "Total Products", value: products.length, Icon: Package, color: "bg-info/10 text-info" },
    { label: "Empty Categories", value: cats.filter((c) => !products.some((p) => p.categoryId === c.id)).length, Icon: AlertTriangle, color: "bg-warning/15 text-warning" },
  ];
  const filtered = cats.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <PageBody>
      <PageHeader
        title="Categories"
        description="Organize your product catalog with categories"
        actions={
          <button onClick={() => { setEditing(null); setOpen(true); }} className="flex items-center gap-2 rounded-xl bg-success px-4 py-2.5 text-sm font-semibold text-success-foreground shadow hover:opacity-90">
            <Plus className="h-4 w-4" /> Add Category
          </button>
        }
      />

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border bg-card p-5 shadow-card">
            <div className="flex items-center gap-4">
              <div className={`grid h-12 w-12 place-items-center rounded-xl ${s.color}`}><s.Icon className="h-6 w-6" /></div>
              <div className="min-w-0"><p className="text-3xl font-extrabold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <div className="border-b p-4">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search categories..." className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-4 text-right">Icon</th>
              <th className="p-4 text-right">Name</th>
              <th className="p-4 text-right">Description</th>
              <th className="p-4 text-right">Products</th>
              <th className="p-4 text-right">Status</th>
              <th className="p-4 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((c) => (
              <tr key={c.id} className="hover:bg-muted/20">
                <td className="p-4">
                  <div className="grid h-10 w-10 place-items-center rounded-xl text-white font-bold" style={{ background: c.color }}>{c.name[0]}</div>
                </td>
                <td className="p-4"><p className="font-bold">{c.name}</p>{c.parentId && <p className="text-xs text-muted-foreground">Sub-category</p>}</td>
                <td className="p-4 text-muted-foreground">{c.description}</td>
                <td className="p-4"><span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">{products.filter((p) => p.categoryId === c.id).length} products</span></td>
                <td className="p-4"><span className={`inline-flex items-center gap-1 text-xs font-semibold ${c.active ? "text-success" : "text-muted-foreground"}`}>● {c.active ? "Active" : "Inactive"}</span></td>
                <td className="p-4">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => { setEditing(c); setOpen(true); }} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => { if (confirm("Supprimer la catégorie ?")) { remove(c.id); toast.success("Supprimé avec succès"); } }} className="grid h-8 w-8 place-items-center rounded-lg text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && <CatDialog cat={editing} onClose={() => setOpen(false)} onSave={(c) => { upsert(c); setOpen(false); toast.success("Enregistré avec succès"); }} />}
    </PageBody>
  );
}

function CatDialog({ cat, onClose, onSave }: { cat: Category | null; onClose: () => void; onSave: (c: Category) => void }) {
  const [f, setF] = useState<Category>(cat ?? { id: crypto.randomUUID(), name: "", color: "#3b82f6", active: true, createdAt: new Date().toISOString() });
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-card p-5" onClick={(e) => e.stopPropagation()} dir="ltr">
        <h2 className="text-lg font-bold mb-4">{cat ? "Modifier la catégorie" : "Ajouter une catégorie"}</h2>
        <div className="space-y-3">
          <label className="block"><span className="text-xs">Nom</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm" /></label>
          <label className="block"><span className="text-xs">Description</span><input value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm" /></label>
          <label className="block"><span className="text-xs">Couleur</span><input type="color" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} className="mt-1 h-10 w-full rounded-xl border" /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Actif</label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border px-4 py-2 text-sm">Annuler</button>
          <button onClick={() => onSave(f)} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Enregistrer</button>
        </div>
      </div>
    </div>
  );
}
