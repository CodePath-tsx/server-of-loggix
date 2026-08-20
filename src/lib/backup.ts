/**
 * Sauvegarde & Restauration — LogixStore.
 *
 * Navigateur : lecture/écriture de l'état Zustand (persisté dans localStorage).
 * Electron    : l'état provient de SQLite (source de vérité locale) et le fichier
 *               est écrit/lu via une boîte de dialogue native (IPC sécurisé).
 */
import { useMBStore } from "@/lib/mb-store";
import { ipc, isElectron } from "@/lib/ipc-bridge";

export const BACKUP_FORMAT = "logixstore-backup";
export const BACKUP_VERSION = 1;
const PERSIST_KEY = "managbyte-db-v1";

/** Clés de données réellement sauvegardées (les fonctions du store sont exclues). */
const DATA_KEYS = [
  "users", "categories", "products", "customers", "suppliers",
  "sales", "heldSales", "movements", "expenses", "auditLogs",
  "settings", "license", "seeded", "setupCompleted",
] as const;

export type BackupData = Record<string, unknown>;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  createdAt: string;
  source: "electron" | "browser";
  counts: Record<string, number>;
  data: BackupData;
}

function pickData(state: Record<string, unknown>): BackupData {
  const out: BackupData = {};
  for (const k of DATA_KEYS) {
    const v = state[k];
    if (typeof v !== "function" && v !== undefined) out[k] = v;
  }
  return out;
}

function countOf(data: BackupData): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [k, v] of Object.entries(data)) if (Array.isArray(v)) counts[k] = v.length;
  return counts;
}

/** Construit l'objet de sauvegarde complet. */
export async function buildBackup(): Promise<BackupFile> {
  let data: BackupData;
  if (isElectron && ipc) {
    // SQLite est la source de vérité en mode Electron
    const state = (await ipc.exportState()) as unknown as Record<string, unknown>;
    data = pickData(state ?? {});
  } else {
    data = pickData(useMBStore.getState() as unknown as Record<string, unknown>);
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    source: isElectron ? "electron" : "browser",
    counts: countOf(data),
    data,
  };
}

function suggestedName() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `logixstore-sauvegarde-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
}

/** Exporte la sauvegarde vers un fichier. Retourne un message de résultat. */
export async function exportBackupFile(): Promise<{ ok: boolean; canceled?: boolean; path?: string }> {
  const backup = await buildBackup();
  const json = JSON.stringify(backup, null, 2);
  const name = suggestedName();

  if (isElectron && ipc?.saveBackupFile) {
    const res = await ipc.saveBackupFile(json, name);
    return res ?? { ok: false };
  }

  // Navigateur : téléchargement via un lien temporaire ajouté au DOM (obligatoire sur Firefox).
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
  return { ok: true, path: name };
}

/** Analyse et valide le contenu d'un fichier de sauvegarde. */
export function parseBackup(text: string): BackupData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Fichier illisible : ce n'est pas un JSON valide.");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("Fichier de sauvegarde invalide.");

  const obj = parsed as Record<string, unknown>;

  // Nouveau format { format, version, data }
  if (obj["format"] === BACKUP_FORMAT && obj["data"] && typeof obj["data"] === "object") {
    return obj["data"] as BackupData;
  }
  // Ancien format Zustand persist { state, version }
  if (obj["state"] && typeof obj["state"] === "object") {
    return pickData(obj["state"] as Record<string, unknown>);
  }
  // Ancien format : état brut exporté directement
  if (Array.isArray(obj["products"]) || Array.isArray(obj["sales"]) || Array.isArray(obj["users"])) {
    return pickData(obj);
  }
  throw new Error("Ce fichier ne correspond pas à une sauvegarde LogixStore.");
}

/** Restaure une sauvegarde (SQLite en Electron, localStorage + store sinon). */
export async function restoreBackup(data: BackupData): Promise<void> {
  if (isElectron && ipc?.importState) {
    await ipc.importState(data as never);
    return;
  }
  // Navigateur : on écrit d'abord le stockage persistant puis on met le store à jour.
  const current = useMBStore.getState() as unknown as Record<string, unknown>;
  const merged = { ...pickData(current), ...data };
  localStorage.setItem(PERSIST_KEY, JSON.stringify({ state: merged, version: 0 }));
  useMBStore.setState(merged as never, false);
}

/** Ouvre un fichier de sauvegarde en Electron (dialogue natif). */
export async function pickBackupFileElectron(): Promise<string | null> {
  if (!(isElectron && ipc?.openBackupFile)) return null;
  const res = await ipc.openBackupFile();
  if (!res?.ok || !res.json) return null;
  return res.json;
}
