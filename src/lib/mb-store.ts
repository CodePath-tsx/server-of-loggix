/**
 * ManagByte offline data store.
 * Browser mode : persists to localStorage via Zustand persist middleware.
 * Electron mode: loads initial state from SQLite synchronously (getStateSync),
 *                then syncs every mutation to SQLite via fire-and-forget IPC.
 *                localStorage persist is disabled to avoid double-writes.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { pushNotice } from "@/lib/push-notice";

/* ─────────────────────── Types ─────────────────────── */

export type Role = "administrator" | "manager" | "cashier";

export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  passwordHash: string;
  role: Role;
  active: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  color: string;
  parentId?: string;
  active: boolean;
  createdAt: string;
}

export type SaleType = "piece" | "weight" | "volume" | "length";

export const SALE_TYPE_LABELS: Record<SaleType, string> = {
  piece:  "À la pièce",
  weight: "Au poids (masse)",
  volume: "Au volume",
  length: "À la longueur",
};

export const UNIT_OPTIONS: { value: string; label: string; types: SaleType[] }[] = [
  { value: "kg",  label: "kg",  types: ["weight"] },
  { value: "g",   label: "g", types: ["weight"] },
  { value: "L",   label: "L",  types: ["volume"] },
  { value: "mL",  label: "mL", types: ["volume"] },
  { value: "m",   label: "m",  types: ["length"] },
  { value: "cm",  label: "cm", types: ["length"] },
];

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  categoryId?: string;
  cost: number;
  price: number;
  stock: number;
  minStock: number;
  image?: string;
  description?: string;
  active: boolean;
  createdAt: string;
  saleType?: SaleType;
  unit?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  balance: number;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  balance: number;
  createdAt: string;
}

export type PaymentMethod = "cash" | "card" | "transfer" | "mobile";
export type SaleStatus   = "completed" | "refunded" | "held" | "cancelled";

export interface SaleItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
  saleType?: SaleType;
  unit?: string;
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  customerId?: string;
  customerName: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  taxPct: number;
  total: number;
  payment: PaymentMethod;
  status: SaleStatus;
  cashierId: string;
  createdAt: string;
}

export type StockMovementType = "in" | "out" | "adj" | "transfer";
export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: StockMovementType;
  quantity: number;
  before: number;
  after: number;
  reason?: string;
  userId: string;
  createdAt: string;
}

export type ExpenseType = "product" | "other";

export interface BonDeCommandeItem {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface BonDeCommande {
  number: string;
  supplierName: string;
  supplierAddress?: string;
  supplierPhone?: string;
  deliveryAddress?: string;
  deliveryCity?: string;
  items: BonDeCommandeItem[];
  subtotal: number;
  shipping: number;
  taxPct: number;
  tax: number;
  total: number;
  conditions?: string;
  authorizedBy?: string;
}

export interface Expense {
  id: string;
  type: ExpenseType;
  description: string;
  amount: number;
  reference?: string;
  productId?: string;
  bonDeCommande?: BonDeCommande;
  createdAt: string;
}

export type LicenseType = "trial" | "lifetime" | "subscription" | "enterprise";
export interface License {
  key: string;
  type: LicenseType;
  machineId: string;
  activatedAt: string;
  expiresAt?: string;
  ownerName: string;
}

export interface CompanySettings {
  name: string;
  logo?: string;
  currency: string;
  language: "fr";
  taxPct: number;
  printerSize: "58mm" | "80mm" | "A4";
  theme: "light" | "dark";
  timezone: string;
  address?: string;
  phone?: string;
  taxId?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: string;
  createdAt: string;
}

/* ─────────────────────── Electron IPC helpers ─────────────────────── */

const _eapi = (): any =>
  typeof window !== "undefined" ? (window as any).electronAPI ?? null : null;

/** True when running inside Electron renderer */
export const isElectron: boolean =
  typeof window !== "undefined" && !!(window as any).electronAPI?.isElectron;

/**
 * Fire-and-forget SQLite sync.
 * Called after every Zustand mutation so SQLite stays in sync.
 * Never throws — errors are logged and swallowed so the UI stays fast.
 */
function syncDb(method: string, ...args: unknown[]): void {
  const api = _eapi();
  if (!api) return;
  const fn = api[method] as ((...a: unknown[]) => Promise<unknown>) | undefined;
  if (typeof fn === "function") {
    fn.apply(api, args).catch((e: unknown) =>
      console.error(`[LogixStore DB] ${method} failed:`, e),
    );
  }
}

/**
 * Load full state from SQLite synchronously on module init.
 * Uses sendSync (better-sqlite3 is synchronous) so there is zero
 * rendering flash — the Zustand store starts pre-populated.
 * Returns null when not in Electron or when DB is not yet ready.
 */
function loadElectronState(): Record<string, unknown> | null {
  try {
    const api = _eapi();
    if (!api?.getStateSync) return null;
    return api.getStateSync() as Record<string, unknown>;
  } catch {
    return null;
  }
}

// This runs synchronously at module load time, before React renders.
const _es = loadElectronState();

/* ─────────────────────── Storage ─────────────────────── */

// In Electron we use SQLite exclusively — disable localStorage writes.
const noopStorage = () => ({
  getItem:    (_n: string): null      => null,
  setItem:    (_n: string, _v: string): void => {},
  removeItem: (_n: string): void      => {},
});

/* ─────────────────────── Store interface ─────────────────────── */

interface State {
  users: User[];
  categories: Category[];
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  sales: Sale[];
  movements: StockMovement[];
  expenses: Expense[];
  license: License | null;
  settings: CompanySettings;
  auditLogs: AuditLog[];
  heldSales: Sale[];
  seeded: boolean;
  setupCompleted: boolean;

  setUsers: (u: User[]) => void;
  upsertUser: (u: User) => void;
  removeUser: (id: string) => void;

  upsertCategory: (c: Category) => void;
  removeCategory: (id: string) => void;

  upsertProduct: (p: Product) => void;
  removeProduct: (id: string) => void;

  upsertCustomer: (c: Customer) => void;
  removeCustomer: (id: string) => void;

  upsertSupplier: (s: Supplier) => void;
  removeSupplier: (id: string) => void;

  addSale: (s: Sale) => void;
  updateSale: (s: Sale) => void;
  holdSale: (s: Sale) => void;
  releaseHeld: (id: string) => Sale | undefined;

  addMovement: (m: StockMovement) => void;
  addExpense: (e: Expense) => void;
  removeExpense: (id: string) => void;

  setLicense: (l: License | null) => void;
  setSettings: (s: Partial<CompanySettings>) => void;

  addAudit: (a: AuditLog) => void;

  markSeeded: () => void;
  markSetupCompleted: () => void;
  resetAll: () => void;
}

const defaultSettings: CompanySettings = {
  name: "LogixStore",
  currency: "DZD",
  language: "fr",
  taxPct: 0,
  printerSize: "80mm",
  theme: "light",
  timezone: "Africa/Algiers",
};

/* ─────────────────────── Store ─────────────────────── */

export const useMBStore = create<State>()(
  persist(
    (set, get) => ({
      // ── Initial state: prefer SQLite (Electron) over defaults ──
      users:          (_es?.users          as User[])             ?? [],
      categories:     (_es?.categories     as Category[])         ?? [],
      products:       (_es?.products       as Product[])          ?? [],
      customers:      (_es?.customers      as Customer[])         ?? [],
      suppliers:      (_es?.suppliers      as Supplier[])         ?? [],
      sales:          (_es?.sales          as Sale[])             ?? [],
      movements:      (_es?.movements      as StockMovement[])    ?? [],
      expenses:       (_es?.expenses       as Expense[])          ?? [],
      license:        (_es?.license        as License | null)     ?? null,
      settings:       (_es?.settings       as CompanySettings)    ?? defaultSettings,
      auditLogs:      (_es?.auditLogs      as AuditLog[])         ?? [],
      heldSales:      (_es?.heldSales      as Sale[])             ?? [],
      seeded:         (_es?.seeded         as boolean)            ?? false,
      setupCompleted: (_es?.setupCompleted as boolean)            ?? false,

      /* ── Users ── */
      setUsers: (users) => {
        set({ users });
        syncDb("setUsers", users);
      },
      upsertUser: (u) => {
        set((s) => ({
          users: s.users.some((x) => x.id === u.id)
            ? s.users.map((x) => (x.id === u.id ? u : x))
            : [...s.users, u],
        }));
        syncDb("upsertUser", u);
      },
      removeUser: (id) => {
        set((s) => ({ users: s.users.filter((u) => u.id !== id) }));
        syncDb("removeUser", id);
      },

      /* ── Categories ── */
      upsertCategory: (c) => {
        set((s) => ({
          categories: s.categories.some((x) => x.id === c.id)
            ? s.categories.map((x) => (x.id === c.id ? c : x))
            : [...s.categories, c],
        }));
        syncDb("upsertCategory", c);
      },
      removeCategory: (id) => {
        set((s) => ({ categories: s.categories.filter((c) => c.id !== id) }));
        syncDb("removeCategory", id);
      },

      /* ── Products ── */
      upsertProduct: (p) => {
        set((s) => ({
          products: s.products.some((x) => x.id === p.id)
            ? s.products.map((x) => (x.id === p.id ? p : x))
            : [...s.products, p],
        }));
        syncDb("upsertProduct", p);
      },
      removeProduct: (id) => {
        set((s) => ({ products: s.products.filter((p) => p.id !== id) }));
        syncDb("removeProduct", id);
      },

      /* ── Customers ── */
      upsertCustomer: (c) => {
        set((s) => ({
          customers: s.customers.some((x) => x.id === c.id)
            ? s.customers.map((x) => (x.id === c.id ? c : x))
            : [...s.customers, c],
        }));
        syncDb("upsertCustomer", c);
      },
      removeCustomer: (id) => {
        set((s) => ({ customers: s.customers.filter((c) => c.id !== id) }));
        syncDb("removeCustomer", id);
      },

      /* ── Suppliers ── */
      upsertSupplier: (sp) => {
        set((s) => ({
          suppliers: s.suppliers.some((x) => x.id === sp.id)
            ? s.suppliers.map((x) => (x.id === sp.id ? sp : x))
            : [...s.suppliers, sp],
        }));
        syncDb("upsertSupplier", sp);
      },
      removeSupplier: (id) => {
        set((s) => ({ suppliers: s.suppliers.filter((c) => c.id !== id) }));
        syncDb("removeSupplier", id);
      },

      /* ── Sales ──
       * Computes all stock changes and movements atomically, then persists
       * the entire batch to SQLite in a single transaction via addSaleWithMovements.
       */
      addSale: (sale) => {
        const now = new Date().toISOString();
        const updatedProducts: Product[] = [];
        const movements: StockMovement[] = [];

        for (const item of sale.items) {
          const p = get().products.find((x) => x.id === item.productId);
          if (!p) continue;
          const after = p.stock - item.quantity;
          updatedProducts.push({ ...p, stock: after });
          movements.push({
            id: crypto.randomUUID(),
            productId: p.id,
            productName: p.name,
            type: "out",
            quantity: item.quantity,
            before: p.stock,
            after,
            reason: `Sale ${sale.invoiceNumber}`,
            userId: sale.cashierId,
            createdAt: now,
          });
        }

        set((s) => ({
          sales: [sale, ...s.sales],
          products: s.products.map((p) => {
            const upd = updatedProducts.find((x) => x.id === p.id);
            return upd ?? p;
          }),
          movements: [...movements, ...s.movements],
        }));

        // Atomic SQLite write: sale + stock updates + movements in one transaction
        syncDb("addSaleWithMovements", { sale, updatedProducts, movements });

        // Notifications: sale completed + low stock warnings
        const settings = get().settings;
        pushNotice(
          "success",
          `Vente ${sale.invoiceNumber}`,
          `${sale.customerName} — ${formatMoney(sale.total, settings.currency)}`,
        );
        for (const p of updatedProducts) {
          if (p.stock <= 0) {
            pushNotice("error", `Rupture de stock`, `${p.name} — plus de stock`);
          } else if (p.stock <= p.minStock) {
            pushNotice("warning", `Stock bas`, `${p.name} — ${p.stock} restant(s) (min: ${p.minStock})`);
          }
        }
      },
      updateSale: (sale) => {
        set((s) => ({ sales: s.sales.map((x) => (x.id === sale.id ? sale : x)) }));
        syncDb("updateSale", sale);
      },
      holdSale: (sale) => {
        set((s) => ({ heldSales: [sale, ...s.heldSales] }));
        syncDb("holdSale", sale);
      },
      releaseHeld: (id) => {
        const sale = get().heldSales.find((s) => s.id === id);
        if (sale) {
          set((s) => ({ heldSales: s.heldSales.filter((x) => x.id !== id) }));
          syncDb("releaseHeld", id);
        }
        return sale;
      },

      /* ── Inventory movements (direct, not via sale) ── */
      addMovement: (m) => {
        set((s) => ({ movements: [m, ...s.movements] }));
        syncDb("addMovement", m);
      },

      /* ── Expenses ── */
      addExpense: (e) => {
        set((s) => ({ expenses: [e, ...s.expenses] }));
        syncDb("addExpense", e);
        const settings = get().settings;
        pushNotice("info", "Dépense enregistrée", `${e.description} — ${formatMoney(e.amount, settings.currency)}`);
      },
      removeExpense: (id) => {
        set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) }));
        syncDb("removeExpense", id);
      },

      /* ── License & Settings ── */
      setLicense: (license) => {
        set({ license });
        syncDb("setLicense", license);
      },
      setSettings: (patch) => {
        set((s) => ({ settings: { ...s.settings, ...patch } }));
        syncDb("setSettings", patch);
      },

      /* ── Audit ── */
      addAudit: (a) => {
        set((s) => ({ auditLogs: [a, ...s.auditLogs].slice(0, 5000) }));
        syncDb("addAudit", a);
      },

      /* ── Meta ── */
      markSeeded: () => {
        set({ seeded: true });
        syncDb("markSeeded");
      },
      markSetupCompleted: () => {
        set({ setupCompleted: true });
        syncDb("markSetupCompleted");
      },
      resetAll: () => {
        set({
          users: [], categories: [], products: [], customers: [],
          suppliers: [], sales: [], movements: [], expenses: [],
          license: null, settings: defaultSettings, auditLogs: [],
          heldSales: [], seeded: false, setupCompleted: false,
        });
        syncDb("resetAll");
      },
    }),
    {
      name: "managbyte-db-v1",
      // In Electron: use no-op storage (SQLite is the source of truth).
      // In browser : use localStorage as before.
      storage: createJSONStorage(isElectron ? noopStorage : () => localStorage),
    },
  ),
);

/* ─────────────────────── Utils ─────────────────────── */

export function formatMoney(v: number, currency = "DZD") {
  return `${currency} ${Math.round(v).toLocaleString("en-US")}`;
}

export function nextInvoiceNumber(existing: Sale[]) {
  const today = new Date();
  const yyyymmdd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const prefix = `REC-${yyyymmdd}-`;
  const nums = existing
    .filter((s) => s.invoiceNumber.startsWith(prefix))
    .map((s) => parseInt(s.invoiceNumber.slice(prefix.length), 10))
    .filter((n) => !Number.isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}
