import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2, Pencil, Phone, Mail, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useMBStore, formatMoney, type Supplier } from "@/lib/mb-store";
import { PageBody, PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/_app/suppliers")({ component: SuppliersPage });

function SuppliersPage() {
  const suppliers = useMBStore((s) => s.suppliers);
  const currency = useMBStore((s) => s.settings.currency);
  const upsert = useMBStore((s) => s.upsertSupplier);
  const remove = useMBStore((s) => s.removeSupplier);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = suppliers.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <PageBody>
      <PageHeader title="Suppliers" description="Manage your supplier network"
        actions={<button onClick={() => { setEditing(null); setOpen(true); }} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> Add Supplier</button>}
      />
      <div className="rounded-2xl border bg-card p-4 shadow-card">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search suppliers..." className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((s) => (
          <div key={s.id} className="rounded-2xl border bg-card p-5 shadow-card">
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-warning/15 text-warning font-bold">{s.name[0]?.toUpperCase()}</div>
              <div className="min-w-0 flex-1"><p className="font-bold truncate">{s.name}</p><p className="text-xs text-muted-foreground">Balance: {formatMoney(s.balance, currency)}</p></div>
              <div className="flex gap-1">
                <button onClick={() => { setEditing(s); setOpen(true); }} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => { if (confirm("Supprimer ?")) { remove(s.id); toast.success("Succès"); } }} className="grid h-8 w-8 place-items-center rounded-lg text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              {s.phone && <p className="flex items-center gap-2"><Phone className="h-3 w-3" /> {s.phone}</p>}
              {s.email && <p className="flex items-center gap-2"><Mail className="h-3 w-3" /> {s.email}</p>}
              {s.address && <p className="flex items-center gap-2"><MapPin className="h-3 w-3" /> {s.address}</p>}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="col-span-full p-12 text-center text-muted-foreground">Aucun fournisseur</p>}
      </div>
      {open && <SupplierDialog s={editing} onClose={() => setOpen(false)} onSave={(s) => { upsert(s); setOpen(false); toast.success("Enregistré avec succès"); }} />}
    </PageBody>
  );
}

function SupplierDialog({ s, onClose, onSave }: { s: Supplier | null; onClose: () => void; onSave: (s: Supplier) => void }) {
  const [f, setF] = useState<Supplier>(s ?? { id: crypto.randomUUID(), name: "", balance: 0, createdAt: new Date().toISOString() });
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-card p-5 space-y-3" onClick={(e) => e.stopPropagation()} dir="ltr">
        <h2 className="text-lg font-bold">{s ? "Modifier le fournisseur" : "Ajouter un fournisseur"}</h2>
        {[["name","Nom","text"],["phone","Téléphone","tel"],["email","Email","email"],["address","Adresse","text"],["balance","Solde","number"]].map(([k,l,t]) => (
          <label key={k} className="block"><span className="text-xs">{l}</span><input type={t} value={(f as any)[k] ?? ""} onChange={(e) => setF({ ...f, [k]: t === "number" ? +e.target.value : e.target.value })} className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm" /></label>
        ))}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-xl border px-4 py-2 text-sm">Annuler</button>
          <button onClick={() => { if (!f.name) return; onSave(f); }} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Enregistrer</button>
        </div>
      </div>
    </div>
  );
}
