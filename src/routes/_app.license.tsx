import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { KeyRound, ShieldCheck, Cpu, RefreshCcw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useMBStore, formatMoney } from "@/lib/mb-store";
import { PageBody, PageHeader } from "@/components/app-shell";
import { LicenseTerminalsPanel } from "@/components/license-terminals";

export const Route = createFileRoute("/_app/license")({ component: LicensePage });

function LicensePage() {
  const navigate = useNavigate();
  const license = useMBStore((s) => s.license);
  const setLicense = useMBStore((s) => s.setLicense);
  if (!license) return <PageBody><p>Aucune licence</p></PageBody>;

  const expiresIn = license.expiresAt
    ? Math.max(0, Math.round((new Date(license.expiresAt).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <PageBody>
      <PageHeader title="License" description="Manage your application license" />

      <div className="rounded-3xl border bg-gradient-to-br from-primary to-primary-hover p-8 text-primary-foreground shadow-primary">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest opacity-80">Current License</p>
            <p className="mt-3 text-3xl font-extrabold capitalize">{license.type}</p>
            <p className="mt-1 opacity-80">{license.ownerName}</p>
          </div>
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/10 backdrop-blur">
            <ShieldCheck className="h-8 w-8" />
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Info label="Key" value={license.key} mono />
          <Info label="Machine ID" value={license.machineId} mono />
          <Info label="Activated" value={new Date(license.activatedAt).toLocaleDateString("en-GB")} />
        </div>
        {expiresIn !== null && (
          <div className="mt-6 rounded-2xl bg-white/10 p-4 backdrop-blur">
            <p className="text-xs uppercase tracking-wider opacity-80">Expires In</p>
            <p className="mt-1 text-2xl font-extrabold">{expiresIn} jours</p>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <button onClick={() => navigate({ to: "/activate" })} className="flex items-center gap-3 rounded-2xl border bg-card p-5 shadow-card hover:shadow-elevated">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><RefreshCcw className="h-5 w-5" /></div>
          <div className="text-right"><p className="font-bold">Renouveler / Changer</p><p className="text-xs text-muted-foreground">Entrez une nouvelle clé</p></div>
        </button>
        <div className="flex items-center gap-3 rounded-2xl border bg-card p-5 shadow-card">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-info/10 text-info"><Cpu className="h-5 w-5" /></div>
          <div className="text-right"><p className="font-bold">Machine Locked</p><p className="text-xs text-muted-foreground">Lié à un seul appareil</p></div>
        </div>
        <button onClick={() => { if (confirm("Désactiver la licence ?")) { setLicense(null); toast.success("Succès"); navigate({ to: "/activate" }); } }} className="flex items-center gap-3 rounded-2xl border bg-card p-5 shadow-card hover:shadow-elevated">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-destructive/10 text-destructive"><XCircle className="h-5 w-5" /></div>
          <div className="text-right"><p className="font-bold">Désactiver</p><p className="text-xs text-muted-foreground">Supprimer la licence</p></div>
        </button>
      </div>

      <LicenseTerminalsPanel />
    </PageBody>
  );
}
function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-2xl bg-white/10 p-3 backdrop-blur">
      <p className="text-[10px] uppercase tracking-wider opacity-80">{label}</p>
      <p className={`mt-1 text-sm truncate ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
