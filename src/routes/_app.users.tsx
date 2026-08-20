import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, Trash2, Mail, Shield, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { useMBStore, type User, type Role } from "@/lib/mb-store";
import { hashPassword } from "@/lib/auth";
import { PageBody, PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/_app/users")({ component: UsersPage });

function UsersPage() {
  const users = useMBStore((s) => s.users);
  const upsert = useMBStore((s) => s.upsertUser);
  const remove = useMBStore((s) => s.removeUser);
  const [tab, setTab] = useState<"users" | "roles">("users");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  return (
    <PageBody>
      <PageHeader title="Users & Access Control" description="Manage team members, roles, and permissions"
        actions={<button onClick={() => { setEditing(null); setOpen(true); }} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> Add User</button>}
      />

      <div className="border-b flex gap-6">
        <button onClick={() => setTab("users")} className={`pb-3 text-sm font-bold ${tab === "users" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}>👥 Users <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs">{users.length}</span></button>
        <button onClick={() => setTab("roles")} className={`pb-3 text-sm font-bold ${tab === "roles" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}>🛡 Roles &amp; Permissions <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs">3</span></button>
      </div>

      {tab === "users" && (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-4 text-right">User</th>
                <th className="p-4 text-right">Email</th>
                <th className="p-4 text-right">Role</th>
                <th className="p-4 text-right">Last Login</th>
                <th className="p-4 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-muted/20">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`grid h-10 w-10 place-items-center rounded-full text-white text-sm font-bold ${u.role === "administrator" ? "bg-destructive" : u.role === "manager" ? "bg-primary" : "bg-success"}`}>
                        {u.displayName.split(" ").map((x) => x[0]).slice(0,2).join("")}
                      </div>
                      <div><p className="font-bold">{u.displayName}</p><p className="text-xs text-muted-foreground">@{u.username}</p></div>
                    </div>
                  </td>
                  <td className="p-4"><p className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3 w-3" /> {u.email}</p></td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${u.role === "administrator" ? "bg-destructive/10 text-destructive" : u.role === "manager" ? "bg-primary/10 text-primary" : "bg-success/15 text-success"}`}>
                      {u.role === "administrator" && <Shield className="h-3 w-3" />} {u.role}
                    </span>
                  </td>
                  <td className="p-4 text-xs text-muted-foreground">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("en-GB") : "—"}</td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => { setEditing(u); setOpen(true); }} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent"><Pencil className="h-4 w-4" /></button>
                      <button className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent" title="Changer le mot de passe"><KeyRound className="h-4 w-4" /></button>
                      <button onClick={() => { if (confirm("Supprimer l'utilisateur ?")) { remove(u.id); toast.success("Effectué"); } }} className="grid h-8 w-8 place-items-center rounded-lg text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t p-4 text-sm text-muted-foreground">Showing 1 to {users.length} of {users.length} users</div>
        </div>
      )}

      {tab === "roles" && (
        <div className="grid gap-4 md:grid-cols-3">
          {(["administrator", "manager", "cashier"] as Role[]).map((r) => (
            <div key={r} className="rounded-2xl border bg-card p-5 shadow-card">
              <div className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase ${r === "administrator" ? "bg-destructive/10 text-destructive" : r === "manager" ? "bg-primary/10 text-primary" : "bg-success/15 text-success"}`}>{r}</div>
              <p className="mt-4 text-sm text-muted-foreground">
                {r === "administrator" && "Accès complet à toutes les fonctionnalités du système."}
                {r === "manager" && "Gestion catalogue, stock, rapports et clients (sans accès utilisateurs)."}
                {r === "cashier" && "Utilisation du POS, consultation factures, gestion clients."}
              </p>
              <p className="mt-4 text-xs text-muted-foreground">{users.filter((u) => u.role === r).length} users</p>
            </div>
          ))}
        </div>
      )}

      {open && <UserDialog u={editing} onClose={() => setOpen(false)} onSave={async (u, pw) => {
        const passwordHash = pw ? await hashPassword(pw) : u.passwordHash;
        upsert({ ...u, passwordHash });
        setOpen(false); toast.success("Enregistré");
      }} />}
    </PageBody>
  );
}

function UserDialog({ u, onClose, onSave }: { u: User | null; onClose: () => void; onSave: (u: User, pw?: string) => void }) {
  const [f, setF] = useState<User>(u ?? { id: crypto.randomUUID(), username: "", displayName: "", email: "", passwordHash: "", role: "cashier", active: true, createdAt: new Date().toISOString() });
  const [pw, setPw] = useState("");
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-card p-5 space-y-3" onClick={(e) => e.stopPropagation()} dir="ltr">
        <h2 className="text-lg font-bold">{u ? "Modifier utilisateur" : "Ajouter utilisateur"}</h2>
        <label className="block"><span className="text-xs">Nom affiché</span><input value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm" /></label>
        <label className="block"><span className="text-xs">Nom d'utilisateur</span><input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm" /></label>
        <label className="block"><span className="text-xs">E-mail</span><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm" /></label>
        <label className="block"><span className="text-xs">{u ? "Nouveau mot de passe (laisser vide pour ne pas modifier)" : "Mot de passe"}</span><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm" /></label>
        <label className="block"><span className="text-xs">Rôle</span>
          <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })} className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm">
            <option value="administrator">Administrator</option><option value="manager">Manager</option><option value="cashier">Cashier</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Actif</label>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-xl border px-4 py-2 text-sm">Annuler</button>
          <button onClick={() => { if (!f.username || !f.displayName) return; if (!u && !pw) { toast.error("Entrez le mot de passe"); return; } onSave(f, pw); }} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Enregistrer</button>
        </div>
      </div>
    </div>
  );
}
