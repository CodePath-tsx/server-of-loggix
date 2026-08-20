import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2, Pencil, Phone, Mail, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useMBStore, formatMoney, type Customer } from "@/lib/mb-store";
import { PageBody, PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/_app/customers")({ component: CustomersPage });

function CustomersPage() {
  const customers = useMBStore((s) => s.customers);
  const sales = useMBStore((s) => s.sales);
  const currency = useMBStore((s) => s.settings.currency);
  const upsert = useMBStore((s) => s.upsertCustomer);
  const remove = useMBStore((s) => s.removeCustomer);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = customers.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <PageBody>
      <PageHeader
        title="Customers" description="Manage your customer database"
        actions={<button onClick={() => { setEditing(null); setOpen(true); }} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"><Plus className="h-4 w-4" /> Add Customer</button>}
      />
      <div className="rounded-2xl border bg-card p-4 shadow-card">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customers..." className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((c) => {
          const cSales = sales.filter((s) => s.customerId === c.id && s.status === "completed");
          const total = cSales.reduce((a, b) => a + b.total, 0);
          return (
            <div key={c.id} className="rounded-2xl border bg-card p-5 shadow-card">
              <div className="flex items-start gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary font-bold">{c.name[0]?.toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">Balance: {formatMoney(c.balance, currency)}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditing(c); setOpen(true); }} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => { if (confirm("Supprimer ?")) { remove(c.id); toast.success("Succès"); } }} className="grid h-8 w-8 place-items-center rounded-lg text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                {c.phone && <p className="flex items-center gap-2"><Phone className="h-3 w-3" /> {c.phone}</p>}
                {c.email && <p className="flex items-center gap-2"><Mail className="h-3 w-3" /> {c.email}</p>}
                {c.address && <p className="flex items-center gap-2"><MapPin className="h-3 w-3" /> {c.address}</p>}
              </div>
              <div className="mt-4 flex items-center justify-between border-t pt-3">
                <div><p className="text-xs text-muted-foreground">Sales</p><p className="text-lg font-extrabold">{cSales.length}</p></div>
                <div className="text-left"><p className="text-xs text-muted-foreground">Total</p><p className="text-lg font-extrabold text-primary">{formatMoney(total, currency)}</p></div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="col-span-full p-12 text-center text-muted-foreground">Aucun client</p>}
      </div>
      {open && <CustomerDialog c={editing} onClose={() => setOpen(false)} onSave={(c) => { upsert(c); setOpen(false); toast.success("Enregistré avec succès"); }} />}
    </PageBody>
  );
}

function CustomerDialog({ c, onClose, onSave }: { c: Customer | null; onClose: () => void; onSave: (c: Customer) => void }) {
  const [f, setF] = useState<Customer>(c ?? { id: crypto.randomUUID(), name: "", balance: 0, createdAt: new Date().toISOString() });
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-card p-5 space-y-3" onClick={(e) => e.stopPropagation()} dir="ltr">
        <h2 className="text-lg font-bold">{c ? "Modifier le client" : "Ajouter un client"}</h2>
        {[["name","Nom","text"],["phone","Téléphone","tel"],["email","Email","email"],["address","Adresse","text"],["notes","Notes","text"],["balance","Solde","number"]].map(([k,l,t]) => (
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
