/**
 * Panneau « Licence multi-terminaux » : plan du magasin, utilisation réelle
 * des postes de caisse et des afficheurs, activation d'une clé LGX-XXXX-XXXX-XXXX.
 */
import { useEffect, useState } from "react";
import { Loader2, RefreshCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { licenseApi, type LicenseCurrent } from "@/lib/sync/terminals-api";
import { loadSyncConfig } from "@/lib/sync/config";

const PLANS = [
  { value: "standard", label: "Standard — 3 postes / 2 afficheurs" },
  { value: "pro", label: "Pro — 10 postes / 6 afficheurs" },
  { value: "enterprise", label: "Enterprise — 50 postes / 30 afficheurs" },
] as const;

type Plan = (typeof PLANS)[number]["value"];

export function LicenseTerminalsPanel() {
  const [enabled] = useState(() => loadSyncConfig().enabled);
  const [data, setData] = useState<LicenseCurrent | null>(null);
  const [loading, setLoading] = useState(false);
  const [key, setKey] = useState("");
  const [plan, setPlan] = useState<Plan>("pro");

  const load = async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      setData(await licenseApi.current());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Serveur injoignable");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const activate = async () => {
    if (!key.trim()) {
      toast.error("Saisissez une clé de licence");
      return;
    }
    setLoading(true);
    try {
      const res = await licenseApi.activate({ licenseKey: key.trim().toUpperCase(), plan });
      toast.success(res.message);
      setKey("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Activation impossible");
    } finally {
      setLoading(false);
    }
  };

  if (!enabled) {
    return (
      <div className="rounded-2xl border bg-card p-5 shadow-card">
        <p className="font-bold">Licence multi-terminaux</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Activez la synchronisation dans « État du serveur » pour gérer la licence multi-postes.
        </p>
      </div>
    );
  }

  const u = data?.usage;

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold">
          <ShieldCheck className="h-4 w-4" /> Licence multi-terminaux
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <Badge variant={data.statut === "active" ? "default" : "destructive"}>
              {data.statut === "active" ? "Active" : data.statut === "expiree" ? "Expirée" : "Aucune"}
            </Badge>
          )}
          <Button size="sm" variant="ghost" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {data?.license && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Clé" value={data.license.licenseKey} mono />
          <Field label="Plan" value={data.license.plan} />
          <Field
            label="Expiration"
            value={data.license.expiresAt ? new Date(data.license.expiresAt).toLocaleDateString("fr-FR") : "Illimitée"}
          />
        </div>
      )}

      {u && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Usage label="Postes de caisse" used={u.postes} max={u.postesMax} />
          <Usage label="Afficheurs de prix" used={u.afficheurs} max={u.afficheursMax} />
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <div className="space-y-2">
          <Label htmlFor="lic-key">Nouvelle clé (LGX-XXXX-XXXX-XXXX)</Label>
          <Input id="lic-key" value={key} onChange={(e) => setKey(e.target.value)} placeholder="LGX-A1B2-C3D4-E5F6" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lic-plan">Plan</Label>
          <select
            id="lic-plan"
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={plan}
            onChange={(e) => setPlan(e.target.value as Plan)}
          >
            {PLANS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={() => void activate()} disabled={loading}>
          Activer
        </Button>
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 truncate text-sm capitalize ${mono ? "font-mono uppercase" : ""}`}>{value}</p>
    </div>
  );
}

function Usage({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {used} / {max}
        </span>
      </div>
      <Progress value={pct} className="mt-3" />
    </div>
  );
}
