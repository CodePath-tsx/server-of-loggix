/**
 * ManagByte — IPC bridge for the renderer process.
 *
 * In Electron: window.electronAPI is injected by preload.cjs via contextBridge.
 * In browser:  window.electronAPI is undefined — fall back to localStorage/web mode.
 */

import type {
  User, Category, Product, Customer, Supplier,
  Sale, StockMovement, Expense, License, CompanySettings, AuditLog,
} from './mb-store';
import type { Session } from './auth';

/* ── Detection ── */
export const isElectron: boolean =
  typeof window !== 'undefined' && !!(window as ElectronWindow).electronAPI;

/* ── Types ── */
export interface ElectronState {
  users: User[];
  categories: Category[];
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  sales: Sale[];
  heldSales: Sale[];
  movements: StockMovement[];
  expenses: Expense[];
  auditLogs: AuditLog[];
  settings: CompanySettings;
  license: License | null;
  session: Session | null;
  seeded: boolean;
  setupCompleted: boolean;
}

export interface ElectronAPI {
  isElectron: true;

  // Init (synchronous)
  getStateSync(): ElectronState | null;
  getMachineIdSync(): string;

  // Users
  upsertUser(u: User): Promise<void>;
  removeUser(id: string): Promise<void>;
  setUsers(users: User[]): Promise<void>;

  // Categories
  upsertCategory(c: Category): Promise<void>;
  removeCategory(id: string): Promise<void>;

  // Products
  upsertProduct(p: Product): Promise<void>;
  removeProduct(id: string): Promise<void>;

  // Customers
  upsertCustomer(c: Customer): Promise<void>;
  removeCustomer(id: string): Promise<void>;

  // Suppliers
  upsertSupplier(s: Supplier): Promise<void>;
  removeSupplier(id: string): Promise<void>;

  // Sales
  addSaleWithMovements(payload: { sale: Sale; updatedProducts: Product[]; movements: StockMovement[] }): Promise<void>;
  updateSale(s: Sale): Promise<void>;
  holdSale(s: Sale): Promise<void>;
  releaseHeld(id: string): Promise<Sale | null>;

  // Inventory
  addMovement(m: StockMovement): Promise<void>;

  // Expenses
  addExpense(e: Expense): Promise<void>;
  removeExpense(id: string): Promise<void>;

  // License & Settings
  setLicense(l: License | null): Promise<void>;
  setSettings(patch: Partial<CompanySettings>): Promise<void>;

  // Auth
  setSession(s: Session | null): Promise<void>;

  // Audit
  addAudit(a: AuditLog): Promise<void>;

  // Meta
  markSeeded(): Promise<void>;
  markSetupCompleted(): Promise<void>;
  resetAll(): Promise<void>;

  // Sauvegarde / Restauration
  exportState(): Promise<ElectronState>;
  importState(state: Partial<ElectronState>): Promise<boolean>;
  saveBackupFile(json: string, name: string): Promise<{ ok: boolean; canceled?: boolean; path?: string }>;
  openBackupFile(): Promise<{ ok: boolean; canceled?: boolean; path?: string; json?: string }>;

  // App
  getVersion(): Promise<string>;
}

interface ElectronWindow {
  electronAPI?: ElectronAPI;
}

/** Typed access to the Electron API (null in browser). */
export const ipc: ElectronAPI | null = isElectron
  ? (window as ElectronWindow).electronAPI!
  : null;

/**
 * Fire-and-forget IPC call — never throws in the renderer.
 * Errors are logged to the console and swallowed so UI mutations remain fast.
 */
export function syncToDb<T extends unknown[]>(
  method: keyof ElectronAPI,
  ...args: T
): void {
  if (!ipc) return;
  const fn = ipc[method] as ((...a: T) => Promise<unknown>) | undefined;
  if (typeof fn === 'function') {
    fn.apply(ipc, args).catch((err: unknown) =>
      console.error(`[IPC] ${String(method)} failed:`, err),
    );
  }
}
