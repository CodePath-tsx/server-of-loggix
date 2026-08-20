/** Accès REST aux terminaux et à la licence multi-terminaux du serveur central. */
import { api } from "./api-client";

export const POS_CODES = Array.from({ length: 10 }, (_, i) => `POS-${String(i + 1).padStart(2, "0")}`);
export const DISPLAY_CODES = Array.from({ length: 6 }, (_, i) => `DISPLAY-${String(i + 1).padStart(2, "0")}`);

export interface Terminal {
  id: string;
  code: string;
  type: "pos" | "display";
  label?: string | null;
  ipAddress?: string | null;
  isActive: boolean;
  lastSeenAt?: string | null;
  online?: boolean;
  status?: "en_ligne" | "recent" | "hors_ligne";
}

export interface TerminalsResponse {
  terminals: Terminal[];
  availableCodes: { pos: string[]; display: string[] };
}

export const terminalsApi = {
  list: () => api<TerminalsResponse>("/api/terminals"),

  register: (input: { code: string; type: "pos" | "display"; label?: string; ipAddress?: string }) =>
    api<Terminal>("/api/terminals", { method: "POST", body: JSON.stringify(input) }),

  deactivate: (id: string) => api<{ success: boolean }>(`/api/terminals/${id}`, { method: "DELETE" }),

  heartbeat: () =>
    api<{ ok: boolean; terminalId: string | null; serverTime?: string }>("/api/terminals/heartbeat", {
      method: "POST",
      body: JSON.stringify({}),
    }),
};

export interface LicenseUsage {
  postes: number;
  postesMax: number;
  afficheurs: number;
  afficheursMax: number;
}

export interface ServerLicense {
  id: string;
  licenseKey: string;
  plan: "standard" | "pro" | "enterprise";
  maxTerminals: number;
  maxDisplays: number;
  expiresAt?: string | null;
  isActive: boolean;
}

export interface LicenseCurrent {
  license: ServerLicense | null;
  usage: LicenseUsage;
  statut: "aucune" | "active" | "expiree";
}

export const licenseApi = {
  current: () => api<LicenseCurrent>("/api/licenses/current"),
  activate: (input: {
    licenseKey: string;
    plan: "standard" | "pro" | "enterprise";
    maxTerminals?: number;
    maxDisplays?: number;
    expiresAt?: string;
  }) => api<{ license: ServerLicense; message: string }>("/api/licenses/activate", {
    method: "POST",
    body: JSON.stringify(input),
  }),
};
