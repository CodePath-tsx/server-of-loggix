/**
 * SyncManager — moteur de synchronisation local ⇄ serveur central.
 * • Détection de connexion  • Envoi des opérations en attente
 * • Récupération des changements serveur  • Nouvelles tentatives
 * • Détection et signalement des conflits  • État de synchronisation
 */
import { api, pingServer } from "./api-client";
import { pendingQueue, type PendingOperation } from "./pending-queue";
import { loadSyncConfig } from "./config";

export type ConnectionState = "online" | "offline" | "syncing";

export interface SyncState {
  connection: ConnectionState;
  lastSyncAt: string | null;
  pending: number;
  conflicts: number;
  serverVersion?: string;
  databaseStatus?: string;
  lastError?: string;
}

type Listener = (state: SyncState) => void;

const LAST_SYNC_KEY = "logix-last-sync";
const LAST_PULL_KEY = "logix-last-pull";

class SyncManager {
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  state: SyncState = {
    connection: "offline",
    lastSyncAt: typeof localStorage !== "undefined" ? localStorage.getItem(LAST_SYNC_KEY) : null,
    pending: 0,
    conflicts: 0,
  };

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  private emit(patch: Partial<SyncState>) {
    this.state = {
      ...this.state,
      ...patch,
      pending: pendingQueue.count(),
      conflicts: pendingQueue.conflicts().length,
    };
    this.listeners.forEach((l) => l(this.state));
  }

  /** Démarre la boucle de synchronisation périodique. */
  start(intervalMs = 15000) {
    if (this.timer) return;
    void this.syncNow();
    this.timer = setInterval(() => void this.syncNow(), intervalMs);
    if (typeof window !== "undefined") {
      window.addEventListener("online", this.onOnline);
      window.addEventListener("offline", this.onOffline);
    }
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.onOnline);
      window.removeEventListener("offline", this.onOffline);
    }
  }

  private onOnline = () => void this.syncNow();
  private onOffline = () => this.emit({ connection: "offline" });

  /** Ajoute une opération à la file locale (mode hors ligne inclus). */
  queue(op: Omit<PendingOperation, "id" | "createdAt" | "status" | "retryCount">) {
    pendingQueue.enqueue(op);
    this.emit({});
    void this.syncNow();
  }

  /** Cycle complet : ping → push → pull. */
  async syncNow(): Promise<SyncState> {
    const cfg = loadSyncConfig();
    if (!cfg.enabled || this.running) return this.state;
    this.running = true;
    try {
      const health = await pingServer();
      if (!health.online) {
        this.emit({ connection: "offline" });
        return this.state;
      }
      this.emit({
        connection: "syncing",
        serverVersion: health.version,
        databaseStatus: health.database,
        lastError: undefined,
      });

      await this.push();
      await this.pull();

      const now = new Date().toISOString();
      if (typeof localStorage !== "undefined") localStorage.setItem(LAST_SYNC_KEY, now);
      this.emit({ connection: "online", lastSyncAt: now });
    } catch (err) {
      this.emit({
        connection: "offline",
        lastError: err instanceof Error ? err.message : "Erreur de synchronisation",
      });
    } finally {
      this.running = false;
    }
    return this.state;
  }

  /** Envoie les opérations en attente vers le serveur. */
  private async push() {
    const ops = pendingQueue.all().filter((o) => o.status !== "conflict");
    if (!ops.length) return;
    const cfg = loadSyncConfig();

    const res = await api<{
      applied: string[];
      conflicts: { id: string; reason: string }[];
      failed: { id: string; error: string }[];
    }>("/api/sync/push", {
      method: "POST",
      body: JSON.stringify({
        terminalId: cfg.terminalId,
        storeId: cfg.storeId,
        operations: ops.map((o) => ({
          id: o.id,
          operation: o.operation,
          entity: o.entity,
          entityId: o.entityId,
          version: o.version,
          payload: o.payload,
          createdAt: o.createdAt,
        })),
      }),
    });

    pendingQueue.markSynced(res.applied ?? []);
    (res.conflicts ?? []).forEach((c) => pendingQueue.markConflict(c.id, c.reason));
    (res.failed ?? []).forEach((f) => pendingQueue.markFailed(f.id, f.error));
    this.emit({});
  }

  /** Récupère les changements du serveur depuis la dernière synchronisation. */
  private async pull() {
    const since =
      (typeof localStorage !== "undefined" && localStorage.getItem(LAST_PULL_KEY)) ||
      new Date(0).toISOString();
    const res = await api<{ changes: Record<string, unknown[]>; serverTime: string }>(
      `/api/sync/pull?since=${encodeURIComponent(since)}`,
      { method: "GET" },
    );
    if (res?.serverTime && typeof localStorage !== "undefined") {
      localStorage.setItem(LAST_PULL_KEY, res.serverTime);
    }
    if (res?.changes) {
      window.dispatchEvent(new CustomEvent("logix:server-changes", { detail: res.changes }));
    }
  }
}

export const syncManager = new SyncManager();
