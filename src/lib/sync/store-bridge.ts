/**
 * Pont entre le magasin local (Zustand / SQLite) et la file de synchronisation.
 *
 * Chaque mutation du magasin appelle `syncDb(method, ...args)` ; ce module
 * traduit cet appel en opération de synchronisation (create / update / delete)
 * placée dans `pendingQueue`, puis pousse vers le serveur central dès que la
 * connexion est disponible.
 *
 * Il applique également, dans l'autre sens, les changements reçus du serveur
 * (événement `logix:server-changes` émis par le SyncManager).
 */
import { pendingQueue } from "./pending-queue";
import { loadSyncConfig } from "./config";
import { syncManager } from "./sync-manager";

type Op = "create" | "update" | "delete";

interface Mapping {
  entity: string;
  operation: Op;
  /** Extrait l'identifiant et la charge utile depuis les arguments du magasin. */
  extract: (args: unknown[]) => { entityId: string; payload: unknown } | null;
}

const byEntity = (entity: string): Mapping => ({
  entity,
  operation: "update",
  extract: (args) => {
    const item = args[0] as { id?: string } | undefined;
    if (!item?.id) return null;
    return { entityId: item.id, payload: item };
  },
});

const byId = (entity: string): Mapping => ({
  entity,
  operation: "delete",
  extract: (args) => {
    const id = args[0];
    return typeof id === "string" ? { entityId: id, payload: { id } } : null;
  },
});

/** Correspondance méthode du magasin → opération de synchronisation. */
const MAP: Record<string, Mapping> = {
  upsertUser: byEntity("users"),
  removeUser: byId("users"),
  upsertCategory: byEntity("categories"),
  removeCategory: byId("categories"),
  upsertProduct: byEntity("products"),
  removeProduct: byId("products"),
  upsertCustomer: byEntity("customers"),
  removeCustomer: byId("customers"),
  upsertSupplier: byEntity("suppliers"),
  removeSupplier: byId("suppliers"),
  updateSale: byEntity("sales"),
  addExpense: { ...byEntity("expenses"), operation: "create" },
  removeExpense: byId("expenses"),
  addMovement: { ...byEntity("movements"), operation: "create" },
  setSettings: {
    entity: "settings",
    operation: "update",
    extract: (args) => ({ entityId: "settings", payload: args[0] }),
  },
  addSaleWithMovements: {
    entity: "sales",
    operation: "create",
    extract: (args) => {
      const batch = args[0] as
        | { sale?: { id?: string }; updatedProducts?: unknown[]; movements?: unknown[] }
        | undefined;
      if (!batch?.sale?.id) return null;
      return { entityId: batch.sale.id, payload: batch };
    },
  },
};

/** Empêche la remise en file des écritures provenant du serveur. */
let applyingRemote = false;

export function isApplyingRemote(): boolean {
  return applyingRemote;
}

/**
 * Appelée par le magasin après chaque mutation.
 * Silencieuse lorsque la synchronisation est désactivée.
 */
export function queueSyncOperation(method: string, args: unknown[]): void {
  if (applyingRemote) return;
  if (typeof window === "undefined") return;
  const cfg = loadSyncConfig();
  if (!cfg.enabled) return;

  const mapping = MAP[method];
  if (!mapping) return;

  const extracted = mapping.extract(args);
  if (!extracted) return;

  try {
    syncManager.queue({
      operation: mapping.operation,
      entity: mapping.entity,
      entityId: extracted.entityId,
      payload: extracted.payload,
    });
  } catch (err) {
    console.error("[LogixSync] mise en file impossible :", err);
  }
}

type ServerChanges = Record<string, unknown[]>;

/**
 * Applique les changements reçus du serveur au magasin local.
 * Import dynamique de mb-store pour éviter une dépendance circulaire.
 */
async function applyServerChanges(changes: ServerChanges): Promise<void> {
  const { useMBStore } = await import("@/lib/mb-store");
  const store = useMBStore.getState();
  applyingRemote = true;
  try {
    for (const row of (changes.products ?? []) as any[]) {
      if (row?.id) store.upsertProduct(row);
    }
    for (const row of (changes.categories ?? []) as any[]) {
      if (row?.id) store.upsertCategory(row);
    }
    for (const row of (changes.customers ?? []) as any[]) {
      if (row?.id) store.upsertCustomer(row);
    }
    for (const row of (changes.suppliers ?? []) as any[]) {
      if (row?.id) store.upsertSupplier(row);
    }
    for (const row of (changes.users ?? []) as any[]) {
      if (row?.id) store.upsertUser(row);
    }
    for (const row of (changes.sales ?? []) as any[]) {
      if (row?.id) store.updateSale(row);
    }
    const settings = (changes.settings ?? [])[0] as Record<string, unknown> | undefined;
    if (settings) store.setSettings(settings as never);
  } finally {
    applyingRemote = false;
  }
}

let installed = false;

/** Installe le pont (à appeler une fois au démarrage de l'application). */
export function installStoreSyncBridge(): () => void {
  if (typeof window === "undefined" || installed) return () => {};
  installed = true;

  const onChanges = (evt: Event) => {
    const detail = (evt as CustomEvent<ServerChanges>).detail;
    if (detail) void applyServerChanges(detail);
  };
  window.addEventListener("logix:server-changes", onChanges);

  const cfg = loadSyncConfig();
  if (cfg.enabled) syncManager.start();

  return () => {
    window.removeEventListener("logix:server-changes", onChanges);
    installed = false;
  };
}

/** Nombre d'opérations en attente (utilisé par l'écran d'état). */
export const pendingCount = () => pendingQueue.count();
