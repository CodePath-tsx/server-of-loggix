import bcrypt from "bcryptjs";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useMBStore, type Role, type User, isElectron } from "./mb-store";

export interface Session {
  userId: string;
  username: string;
  displayName: string;
  role: Role;
  loggedInAt: string;
  remember: boolean;
}

interface AuthState {
  session: Session | null;
  setSession: (s: Session | null) => void;
}

/* ── Electron IPC for session ── */
const _syncSession = (session: Session | null): void => {
  if (!isElectron) return;
  const api = (window as any).electronAPI;
  if (api?.setSession) {
    api.setSession(session).catch((e: unknown) =>
      console.error("[LogixStore DB] setSession failed:", e),
    );
  }
};

/* ── Auth session store ──
 * In Electron: session is persisted to SQLite (via IPC in setSession).
 *              localStorage persist is disabled (noopStorage).
 * In browser : session is persisted to localStorage as before.
 */
const noopStorage = () => ({
  getItem:    (_n: string): null => null,
  setItem:    (_n: string, _v: string): void => {},
  removeItem: (_n: string): void => {},
});

// Load session from Electron SQLite on startup
const _electronSession = (() => {
  try {
    const api = typeof window !== "undefined" ? (window as any).electronAPI : null;
    if (!api?.getStateSync) return null;
    const s = api.getStateSync() as { session?: Session | null } | null;
    return s?.session ?? null;
  } catch {
    return null;
  }
})();

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: _electronSession ?? null,
      setSession: (session) => {
        set({ session });
        _syncSession(session);
      },
    }),
    {
      name: "managbyte-session-v1",
      storage: createJSONStorage(isElectron ? noopStorage : () => localStorage),
    },
  ),
);

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}
export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function login(username: string, password: string, remember: boolean) {
  const users = useMBStore.getState().users;
  const user = users.find((u) => u.username.toLowerCase() === username.toLowerCase());
  if (!user || !user.active) throw new Error("Nom d'utilisateur ou mot de passe incorrect");
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw new Error("Nom d'utilisateur ou mot de passe incorrect");

  const now = new Date().toISOString();
  useMBStore.getState().upsertUser({ ...user, lastLoginAt: now });
  useAuthStore.getState().setSession({
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    loggedInAt: now,
    remember,
  });
  useMBStore.getState().addAudit({
    id: crypto.randomUUID(),
    userId: user.id,
    userName: user.displayName,
    action: "login",
    entity: "auth",
    createdAt: now,
  });
  return user;
}

export function logout() {
  const s = useAuthStore.getState().session;
  if (s) {
    useMBStore.getState().addAudit({
      id: crypto.randomUUID(),
      userId: s.userId,
      userName: s.displayName,
      action: "logout",
      entity: "auth",
      createdAt: new Date().toISOString(),
    });
  }
  useAuthStore.getState().setSession(null);
}

/* ── RBAC ── */

export type Permission =
  | "pos.use"
  | "sales.view"
  | "sales.refund"
  | "products.manage"
  | "categories.manage"
  | "stock.manage"
  | "movements.view"
  | "customers.manage"
  | "suppliers.manage"
  | "expenses.manage"
  | "reports.view"
  | "users.manage"
  | "settings.manage"
  | "license.manage"
  | "backup.manage";

const rolePermissions: Record<Role, Permission[]> = {
  administrator: [
    "pos.use", "sales.view", "sales.refund", "products.manage", "categories.manage",
    "stock.manage", "movements.view", "customers.manage", "suppliers.manage",
    "expenses.manage", "reports.view", "users.manage", "settings.manage",
    "license.manage", "backup.manage",
  ],
  manager: [
    "pos.use", "sales.view", "sales.refund", "products.manage", "categories.manage",
    "stock.manage", "movements.view", "customers.manage", "suppliers.manage",
    "expenses.manage", "reports.view", "backup.manage",
  ],
  cashier: ["pos.use", "sales.view", "customers.manage"],
};

export function hasPermission(role: Role | undefined, perm: Permission): boolean {
  if (!role) return false;
  return rolePermissions[role].includes(perm);
}

export function useSession() {
  return useAuthStore((s) => s.session);
}

export function useHasPermission(perm: Permission) {
  const session = useSession();
  return hasPermission(session?.role, perm);
}

export function currentUserOrThrow(): Session {
  const s = useAuthStore.getState().session;
  if (!s) throw new Error("Not authenticated");
  return s;
}

export function ensureCan(perm: Permission): Session {
  const s = currentUserOrThrow();
  if (!hasPermission(s.role, perm)) throw new Error("Vous n'avez pas la permission pour cette opération");
  return s;
}

export type { User };
