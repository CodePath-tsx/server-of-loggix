/**
 * Écran « État du serveur » : connexion au serveur central, dernière
 * synchronisation, opérations en attente, et enregistrement des terminaux
 * POS-01…POS-10 / DISPLAY-01…DISPLAY-06.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RefreshCcw, Server, Monitor, Trash2, PlugZap, Save } from "lucide-react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { syncManager } from "@/lib/sync/sync-manager";
import { pendingQueue } from "@/lib/sync/pending-queue";
import { connectRealtime, disconnectRealtime } from "@/lib/sync/realtime";
import { connectionBadge, usePendingOperations, useSyncConfig, useSyncState } from "@/hooks/use-sync";
import {
  DISPLAY_CODES,
  POS_CODES,
  terminalsApi,
  type Terminal,
} from "@/lib/sync/terminals-api";

export const Route = createFileRoute("/_app/sync")({
  head: () => ({
    meta: [
      { title: "État du serveur — LogixStore" },
      { name: "description", content: "Connexion au serveur central, synchronisation et terminaux POS." },
      { property: "og:title", content: "État du serveur — LogixStore" },
      { property: "og:description", content: "Connexion au serveur central, synchronisation et terminaux POS." },
    ],
  }),
  component: SyncPage,
});

function SyncPage() {
  const state = useSyncState();
  const badge = connectionBadge(state);
  const ops = usePendingOperations();
  const [cfg, updateCfg] = useSyncConfig();
  const [serverUrl, setServerUrl] = useState(cfg.serverUrl);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [available, setAvailable] = useState<{ pos: string[]; display: string[] }>({ pos: [], display: [] });
  const [busy, setBusy] = useState(false);

  useEffect(() => setServerUrl(cfg.serverUrl), [cfg.serverUrl]);

  const refreshTerminals = async () => {
    if (!cfg.enabled) return;
    try {
      const res = await terminalsApi.list();
      setTerminals(res.terminals);
      setAvailable(res.availableCodes);
    } catch {
      setTerminals([]);
    }
  };

  useEffect(() => {
    void refreshTerminals();
    if (!cfg.enabled) return;
    const id = setInterval(() => void refreshTerminals(), 20000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.enabled, cfg.serverUrl]);

  // Battement de cœur du terminal courant.
  useEffect(() => {
    if (!cfg.enabled) return;
    const beat = () => void terminalsApi.heartbeat().catch(() => {});
    beat();
    const id = setInterval(beat, 60000);
    return () => clearInterval(id);
  }, [cfg.enabled, cfg.serverUrl]);

  const toggleSync = (enabled: boolean) => {
    updateCfg({ enabled });
    if (enabled) {
      syncManager.start();
      connectRealtime();
      toast.success("Synchronisation activée");
    } else {
      syncManager.stop();
      disconnectRealtime();
      toast.info("Synchronisation désactivée — mode local");
    }
  };

  const saveServer = () => {
    updateCfg({ serverUrl: serverUrl.replace(/\/+$/, "") });
    toast.success("Adresse du serveur enregistrée");
    void syncManager.syncNow();
  };

  const register = async (code: string, type: "pos" | "display") => {
    setBusy(true);
    try {
      const terminal = await terminalsApi.register({ code, type });
      updateCfg({ terminalCode: code, terminalId: terminal.id });
      toast.success(`Terminal ${code} enregistré`);
      await refreshTerminals();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async (t: Terminal) => {
    if (!confirm(`Désactiver le terminal ${t.code} ?`)) return;
    try {
      await terminalsApi.deactivate(t.id);
      toast.success(`${t.code} désactivé`);
      await refreshTerminals();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Désactivation impossible");
    }
  };

  return (
    <PageBody>
      <PageHeader
        title="État du serveur"
        description="Connexion au serveur central, synchronisation et terminaux"
        actions={
          <Button onClick={() => void syncManager.syncNow()} variant="outline">
            <RefreshCcw className="mr-2 h-4 w-4" /> Synchroniser
          </Button>
        }
      />

      {/* Voyant d'état */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-card p-5 shadow-card md:col-span-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Connexion</p>
          <p className={`mt-2 text-2xl font-extrabold ${badge.tone}`}>
            {badge.dot} {badge.label}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {cfg.serverUrl} · terminal {cfg.terminalCode}
            {state.serverVersion ? ` · serveur v${state.serverVersion}` : ""}
          </p>
          {state.lastError && <p className="mt-2 text-xs text-destructive">{state.lastError}</p>}
        </div>
        <Stat label="Dernière synchronisation" value={state.lastSyncAt ? new Date(state.lastSyncAt).toLocaleString("fr-FR") : "Jamais"} />
        <Stat label="Opérations en attente" value={`${state.pending}${state.conflicts ? ` · ${state.conflicts} conflit(s)` : ""}`} />
      </div>

      {/* Paramètres réseau */}
      <div className="rounded-2xl border bg-card p-5 shadow-card space-y-4">
        <div className="flex items-center gap-2 font-bold">
          <Server className="h-4 w-4" /> Serveur central
        </div>
        <div className="grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end">
          <div className="space-y-2">
            <Label htmlFor="server-url">Adresse LAN du serveur</Label>
            <Input
              id="server-url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="http://192.168.1.10:3000"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={saveServer} variant="outline">
              <Save className="mr-2 h-4 w-4" /> Enregistrer
            </Button>
            <Button onClick={() => void testConnection()} variant="outline" disabled={testing}>
              {testing ? "Test…" : "Tester la connexion"}
            </Button>
          </div>
          <div className="flex items-center gap-3 rounded-xl border px-4 py-2">
            <PlugZap className="h-4 w-4" />
            <span className="text-sm">Synchronisation</span>
            <Switch checked={cfg.enabled} onCheckedChange={toggleSync} />
          </div>
        </div>
        {diagnostic && (
          <p className="rounded-xl border border-dashed p-3 text-xs font-mono whitespace-pre-wrap">
            {diagnostic}
          </p>
        )}
      </div>

      {/* Terminaux */}
      <div className="rounded-2xl border bg-card p-5 shadow-card space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold">
            <Monitor className="h-4 w-4" /> Terminaux enregistrés
          </div>
          <Button variant="ghost" size="sm" onClick={() => void refreshTerminals()}>
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>

        {!cfg.enabled && (
          <p className="text-sm text-muted-foreground">
            Activez la synchronisation pour gérer les terminaux du serveur central.
          </p>
        )}

        {cfg.enabled && (
          <>
            <div className="grid gap-2">
              {terminals.length === 0 && <p className="text-sm text-muted-foreground">Aucun terminal enregistré.</p>}
              {terminals.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-xl border px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span>{t.status === "en_ligne" ? "🟢" : t.status === "recent" ? "🟡" : "🔴"}</span>
                    <div>
                      <p className="font-semibold">{t.code}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.type === "pos" ? "Poste de caisse" : "Afficheur de prix"}
                        {t.lastSeenAt ? ` · vu ${new Date(t.lastSeenAt).toLocaleString("fr-FR")}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {cfg.terminalCode === t.code && <Badge variant="secondary">Ce poste</Badge>}
                    <Button variant="ghost" size="sm" onClick={() => void deactivate(t)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <CodeGroup
                title="Postes de caisse (POS-01 → POS-10)"
                codes={POS_CODES}
                available={available.pos}
                current={cfg.terminalCode}
                disabled={busy}
                onPick={(code) => void register(code, "pos")}
              />
              <CodeGroup
                title="Afficheurs de prix (DISPLAY-01 → DISPLAY-06)"
                codes={DISPLAY_CODES}
                available={available.display}
                current={cfg.terminalCode}
                disabled={busy}
                onPick={(code) => void register(code, "display")}
              />
            </div>
          </>
        )}
      </div>

      {/* File d'attente */}
      <div className="rounded-2xl border bg-card p-5 shadow-card space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-bold">File d'attente locale ({ops.length})</p>
          {ops.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm("Vider la file d'attente ? Les opérations non envoyées seront perdues.")) {
                  pendingQueue.clear();
                  void syncManager.syncNow();
                }
              }}
            >
              Vider
            </Button>
          )}
        </div>
        {ops.length === 0 && <p className="text-sm text-muted-foreground">Tout est synchronisé.</p>}
        {ops.slice(0, 20).map((o) => (
          <div key={o.id} className="flex items-center justify-between rounded-xl border px-4 py-2 text-sm">
            <span className="font-mono text-xs">{o.entity} · {o.operation}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(o.createdAt).toLocaleTimeString("fr-FR")} · {o.status}
              {o.lastError ? ` · ${o.lastError}` : ""}
            </span>
          </div>
        ))}
      </div>
    </PageBody>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-card">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-bold">{value}</p>
    </div>
  );
}

function CodeGroup({
  title,
  codes,
  available,
  current,
  disabled,
  onPick,
}: {
  title: string;
  codes: string[];
  available: string[];
  current: string;
  disabled: boolean;
  onPick: (code: string) => void;
}) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {codes.map((code) => {
          const free = available.includes(code);
          return (
            <Button
              key={code}
              size="sm"
              disabled={disabled}
              variant={current === code ? "default" : free ? "outline" : "secondary"}
              onClick={() => onPick(code)}
            >
              {code}
            </Button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Cliquez sur un code pour enregistrer ce poste sous cette identité.
      </p>
    </div>
  );
}
