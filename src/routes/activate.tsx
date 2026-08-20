import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, ShieldCheck, Cpu, Copy, Check, Loader2, LogOut } from "lucide-react";
import { useMBStore } from "@/lib/mb-store";
import { getMachineId } from "@/lib/seed";
import { verifyLicense, type LicensePayload } from "@/core/license";
import { useAuthStore, logout } from "@/lib/auth";

export const Route = createFileRoute("/activate")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    if (!useMBStore.getState().setupCompleted) {
      throw redirect({ to: "/setup" });
    }
  },
  component: ActivatePage,
});

function ActivatePage() {
  const navigate = useNavigate();
  const [key, setKey] = useState("");
  const [copied, setCopied] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [machineId, setMachineId] = useState("...");
  const existing = useMBStore((s) => s.license);
  const setLicense = useMBStore((s) => s.setLicense);
  const session = useAuthStore((s) => s.session);

  useEffect(() => { setMachineId(getMachineId()); }, []);

  const activate = async () => {
    const trimmed = key.trim();
    if (!trimmed) return toast.error("Entrez la clé de licence");
    if (!trimmed.startsWith("MB1.")) {
      return toast.error("Format invalide. Les clés commencent par MB1.");
    }
    setVerifying(true);
    try {
      const payload: LicensePayload = await verifyLicense(trimmed, machineId);
      setLicense({
        key: trimmed,
        type: payload.type,
        machineId: payload.machineId,
        activatedAt: new Date().toISOString(),
        expiresAt: payload.expiresAt,
        ownerName: payload.customer,
      });
      toast.success(`Activé avec succès — ${payload.customer}`);
      navigate({ to: "/login" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setVerifying(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(machineId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isValid = !!existing && (!existing.expiresAt || new Date(existing.expiresAt).getTime() > Date.now());

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6" dir="ltr">
      <div className="w-full max-w-lg rounded-3xl border bg-card p-8 shadow-elevated">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <KeyRound className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Licence de l'application</h1>
            <p className="text-sm text-muted-foreground">Entrez une clé Ed25519 signée par l'entreprise</p>
          </div>
        </div>

        {isValid && existing && (
          <div className="mt-4 rounded-2xl border border-success/40 bg-success/5 p-4">
            <div className="flex items-center gap-2 text-success">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-sm font-bold">Activé</span>
            </div>
            <div className="mt-2 space-y-1 text-xs">
              <div><span className="text-muted-foreground">Propriétaire :</span> <span className="font-medium">{existing.ownerName}</span></div>
              <div><span className="text-muted-foreground">Type :</span> <span className="font-medium">{existing.type}</span></div>
              {existing.expiresAt && (
                <div><span className="text-muted-foreground">Expire le :</span> <span className="font-medium">{new Date(existing.expiresAt).toLocaleDateString("fr")}</span></div>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 rounded-2xl border bg-muted/40 p-4">
          <div className="flex items-start gap-3">
            <Cpu className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Machine ID (HWID)</p>
              <p className="mt-1 font-mono text-sm break-all">{machineId}</p>
            </div>
            <button onClick={copy} className="grid h-8 w-8 place-items-center rounded-lg border hover:bg-background" aria-label="Copier">
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Partagez cet identifiant avec le responsable des ventes pour générer une clé Ed25519 liée à votre appareil.
          </p>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium">Clé de licence</label>
            <textarea
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="MB1.eyJj...........XYZ.SIGNATURE_BASE64URL"
              rows={4}
              className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-xs font-mono outline-none focus:ring-2 focus:ring-ring"
              spellCheck={false}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Commence par <code className="font-mono">MB1.</code> et contient une signature Ed25519. Toute clé non signée sera rejetée.
            </p>
          </div>
        </div>

        <button
          onClick={activate}
          disabled={verifying}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-primary transition hover:bg-primary-hover disabled:opacity-60"
        >
          {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ShieldCheck className="h-4 w-4" /> Vérifier et activer</>}
        </button>

        {isValid && (
          <button
            onClick={() => navigate({ to: session ? "/dashboard" : "/login" })}
            className="mt-3 w-full rounded-xl border py-2.5 text-sm font-semibold hover:bg-accent"
          >
            Continuer vers {session ? "Tableau de bord" : "Connexion"}
          </button>
        )}

        {session && (
          <button
            onClick={() => { logout(); navigate({ to: "/login" }); }}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border py-2 text-xs text-muted-foreground hover:bg-accent"
          >
            <LogOut className="h-3 w-3" /> Se déconnecter
          </button>
        )}
      </div>
    </div>
  );
}
