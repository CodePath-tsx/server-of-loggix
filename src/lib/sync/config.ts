/** Configuration réseau du poste (serveur central sur le LAN). */
const LS_KEY = "logix-sync-config";

export interface SyncConfig {
  serverUrl: string;   // ex: http://192.168.1.10:3000
  terminalCode: string; // ex: POS-01 ou DISPLAY-01
  terminalId: string | null;
  storeId: string | null;
  enabled: boolean;
}

export const defaultSyncConfig: SyncConfig = {
  serverUrl: "http://192.168.1.10:3000",
  terminalCode: "POS-01",
  terminalId: null,
  storeId: null,
  enabled: false,
};

export function loadSyncConfig(): SyncConfig {
  if (typeof localStorage === "undefined") return { ...defaultSyncConfig };
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? { ...defaultSyncConfig, ...(JSON.parse(raw) as Partial<SyncConfig>) } : { ...defaultSyncConfig };
  } catch {
    return { ...defaultSyncConfig };
  }
}

export function saveSyncConfig(patch: Partial<SyncConfig>): SyncConfig {
  const next = { ...loadSyncConfig(), ...patch };
  if (typeof localStorage !== "undefined") localStorage.setItem(LS_KEY, JSON.stringify(next));
  return next;
}
