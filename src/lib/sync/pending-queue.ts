/**
 * File d'attente des opérations non synchronisées (mode hors ligne).
 * Stockée localement (localStorage en navigateur, base locale en Electron).
 */
import { ulid } from "@/lib/sync/ulid";

export type SyncStatus = "pending" | "sending" | "failed" | "conflict";

export interface PendingOperation {
  id: string;
  operation: "create" | "update" | "delete";
  entity: string;
  entityId: string;
  payload: unknown;
  version?: number;
  createdAt: string;
  status: SyncStatus;
  retryCount: number;
  lastError?: string;
}

const LS_KEY = "logix-pending-operations";

function read(): PendingOperation[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]") as PendingOperation[];
  } catch {
    return [];
  }
}

function write(ops: PendingOperation[]) {
  if (typeof localStorage !== "undefined") localStorage.setItem(LS_KEY, JSON.stringify(ops));
}

export const pendingQueue = {
  all: read,
  count: () => read().filter((o) => o.status !== "conflict").length,
  conflicts: () => read().filter((o) => o.status === "conflict"),

  enqueue(op: Omit<PendingOperation, "id" | "createdAt" | "status" | "retryCount">): PendingOperation {
    const full: PendingOperation = {
      ...op,
      id: ulid(),
      createdAt: new Date().toISOString(),
      status: "pending",
      retryCount: 0,
    };
    write([...read(), full]);
    return full;
  },

  markSynced(ids: string[]) {
    write(read().filter((o) => !ids.includes(o.id)));
  },

  markFailed(id: string, error: string) {
    write(
      read().map((o) =>
        o.id === id ? { ...o, status: "failed" as SyncStatus, retryCount: o.retryCount + 1, lastError: error } : o,
      ),
    );
  },

  markConflict(id: string, error: string) {
    write(read().map((o) => (o.id === id ? { ...o, status: "conflict" as SyncStatus, lastError: error } : o)));
  },

  clear() {
    write([]);
  },
};
