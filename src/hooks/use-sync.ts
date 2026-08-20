/** Hooks React autour du SyncManager et de la file d'attente. */
import { useEffect, useState } from "react";
import { syncManager, type SyncState } from "@/lib/sync/sync-manager";
import { pendingQueue, type PendingOperation } from "@/lib/sync/pending-queue";
import { loadSyncConfig, saveSyncConfig, type SyncConfig } from "@/lib/sync/config";

/** État de synchronisation en direct (connexion, dernière sync, en attente). */
export function useSyncState(): SyncState {
  const [state, setState] = useState<SyncState>(syncManager.state);
  useEffect(() => syncManager.subscribe(setState), []);
  return state;
}

/** Opérations locales en attente d'envoi. */
export function usePendingOperations(refreshMs = 3000): PendingOperation[] {
  const [ops, setOps] = useState<PendingOperation[]>([]);
  useEffect(() => {
    const tick = () => setOps(pendingQueue.all());
    tick();
    const id = setInterval(tick, refreshMs);
    return () => clearInterval(id);
  }, [refreshMs]);
  return ops;
}

/** Configuration réseau du poste (URL serveur, code terminal). */
export function useSyncConfig(): [SyncConfig, (patch: Partial<SyncConfig>) => void] {
  const [cfg, setCfg] = useState<SyncConfig>(() => loadSyncConfig());
  useEffect(() => setCfg(loadSyncConfig()), []);
  const update = (patch: Partial<SyncConfig>) => setCfg(saveSyncConfig(patch));
  return [cfg, update];
}

/** Couleur / libellé du voyant d'état. */
export function connectionBadge(state: SyncState): { dot: string; label: string; tone: string } {
  if (state.connection === "online" && state.pending === 0)
    return { dot: "🟢", label: "Connecté et synchronisé", tone: "text-success" };
  if (state.connection === "syncing" || (state.connection === "online" && state.pending > 0))
    return { dot: "🟡", label: "Synchronisation en cours", tone: "text-warning" };
  return { dot: "🔴", label: "Hors ligne — mode local", tone: "text-destructive" };
}
