/**
 * Schéma de base de données Drizzle ORM (PostgreSQL).
 * Toutes les tables métier possèdent : identifiant ULID (texte), store_id/branch_id,
 * version (détection de conflit de synchronisation) et updated_at.
 * Les ventes bénéficient en plus d'une suppression logique (deleted_at).
 */
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { ulid } from "ulid";

const ulidPk = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => ulid());

/** Colonnes communes à (presque) toutes les tables métier synchronisées. */
const syncColumns = {
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

// ---------------------------------------------------------------------------
// Organisation : magasins, succursales, terminaux
// ---------------------------------------------------------------------------

export const stores = pgTable("stores", {
  id: ulidPk(),
  name: text("name").notNull(),
  legalName: text("legal_name"),
  taxNumber: text("tax_number"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  currency: text("currency").notNull().default("XOF"),
  ...syncColumns,
});

export const branches = pgTable("branches", {
  id: ulidPk(),
  storeId: text("store_id").notNull().references(() => stores.id),
  name: text("name").notNull(),
  address: text("address"),
  phone: text("phone"),
  isMain: boolean("is_main").notNull().default(false),
  ...syncColumns,
});

export const terminals = pgTable(
  "terminals",
  {
    id: ulidPk(),
    storeId: text("store_id").notNull().references(() => stores.id),
    branchId: text("branch_id").references(() => branches.id),
    code: text("code").notNull(), // ex : POS-01, DISPLAY-01
    type: text("type", { enum: ["pos", "display"] }).notNull().default("pos"),
    label: text("label"),
    ipAddress: text("ip_address"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    ...syncColumns,
  },
  (t) => ({
    codeUnique: uniqueIndex("terminals_code_unique").on(t.code),
  })
);

// ---------------------------------------------------------------------------
// Utilisateurs, rôles, permissions
// ---------------------------------------------------------------------------

export const roles = pgTable(
  "roles",
  {
    id: ulidPk(),
    name: text("name", {
      enum: ["owner", "admin", "manager", "cashier", "stock_manager", "accountant"],
    }).notNull(),
    description: text("description"),
    ...syncColumns,
  },
  (t) => ({ nameUnique: uniqueIndex("roles_name_unique").on(t.name) })
);

export const permissions = pgTable(
  "permissions",
  {
    id: ulidPk(),
    code: text("code").notNull(), // ex : products.create
    description: text("description"),
    ...syncColumns,
  },
  (t) => ({ codeUnique: uniqueIndex("permissions_code_unique").on(t.code) })
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    id: ulidPk(),
    roleId: text("role_id").notNull().references(() => roles.id),
    permissionId: text("permission_id").notNull().references(() => permissions.id),
    ...syncColumns,
  },
  (t) => ({
    uniquePair: uniqueIndex("role_permissions_unique").on(t.roleId, t.permissionId),
  })
);

export const users = pgTable(
  "users",
  {
    id: ulidPk(),
    storeId: text("store_id").notNull().references(() => stores.id),
    branchId: text("branch_id").references(() => branches.id),
    roleId: text("role_id").notNull().references(() => roles.id),
    fullName: text("full_name").notNull(),
    username: text("username").notNull(),
    email: text("email"),
    passwordHash: text("password_hash").notNull(),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...syncColumns,
  },
  (t) => ({ usernameUnique: uniqueIndex("users_username_unique").on(t.username) })
);

export const sessions = pgTable("sessions", {
  id: ulidPk(),
  userId: text("user_id").notNull().references(() => users.id),
  terminalId: text("terminal_id").references(() => terminals.id),
  refreshTokenHash: text("refresh_token_hash").notNull(),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Catalogue produits
// ---------------------------------------------------------------------------

export const brands = pgTable("brands", {
  id: ulidPk(),
  storeId: text("store_id").notNull().references(() => stores.id),
  branchId: text("branch_id").references(() => branches.id),
  name: text("name").notNull(),
  ...syncColumns,
});

export const categories = pgTable("categories", {
  id: ulidPk(),
  storeId: text("store_id").notNull().references(() => stores.id),
  branchId: text("branch_id").references(() => branches.id),
  name: text("name").notNull(),
  parentId: text("parent_id"),
  ...syncColumns,
});

export const units = pgTable("units", {
  id: ulidPk(),
  storeId: text("store_id").notNull().references(() => stores.id),
  branchId: text("branch_id").references(() => branches.id),
  name: text("name").notNull(), // ex : pièce, kg, litre
  symbol: text("symbol").notNull(),
  ...syncColumns,
});

export const products = pgTable(
  "products",
  {
    id: ulidPk(),
    storeId: text("store_id").notNull().references(() => stores.id),
    branchId: text("branch_id").references(() => branches.id),
    categoryId: text("category_id").references(() => categories.id),
    brandId: text("brand_id").references(() => brands.id),
    unitId: text("unit_id").references(() => units.id),
    sku: text("sku").notNull(),
    barcode: text("barcode"),
    name: text("name").notNull(),
    description: text("description"),
    costPrice: numeric("cost_price", { precision: 14, scale: 2 }).notNull().default("0"),
    sellingPrice: numeric("selling_price", { precision: 14, scale: 2 }).notNull().default("0"),
    taxId: text("tax_id"),
    isActive: boolean("is_active").notNull().default(true),
    lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
    ...syncColumns,
  },
  (t) => ({
    skuUnique: uniqueIndex("products_sku_unique").on(t.storeId, t.sku),
    barcodeIdx: index("products_barcode_idx").on(t.barcode),
  })
);

export const taxes = pgTable("taxes", {
  id: ulidPk(),
  storeId: text("store_id").notNull().references(() => stores.id),
  name: text("name").notNull(),
  rate: numeric("rate", { precision: 6, scale: 3 }).notNull(), // pourcentage ex : 18.000
  isInclusive: boolean("is_inclusive").notNull().default(true),
  ...syncColumns,
});

export const discounts = pgTable("discounts", {
  id: ulidPk(),
  storeId: text("store_id").notNull().references(() => stores.id),
  name: text("name").notNull(),
  type: text("type", { enum: ["percentage", "fixed"] }).notNull(),
  value: numeric("value", { precision: 14, scale: 2 }).notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  ...syncColumns,
});

// ---------------------------------------------------------------------------
// Stock
// ---------------------------------------------------------------------------

export const inventory = pgTable(
  "inventory",
  {
    id: ulidPk(),
    storeId: text("store_id").notNull().references(() => stores.id),
    branchId: text("branch_id").notNull().references(() => branches.id),
    productId: text("product_id").notNull().references(() => products.id),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull().default("0"),
    reservedQuantity: numeric("reserved_quantity", { precision: 14, scale: 3 }).notNull().default("0"),
    ...syncColumns,
  },
  (t) => ({
    productBranchUnique: uniqueIndex("inventory_product_branch_unique").on(t.productId, t.branchId),
  })
);

export const inventoryMovements = pgTable("inventory_movements", {
  id: ulidPk(),
  storeId: text("store_id").notNull().references(() => stores.id),
  branchId: text("branch_id").notNull().references(() => branches.id),
  productId: text("product_id").notNull().references(() => products.id),
  type: text("type", {
    enum: ["sale", "return", "purchase", "adjustment", "transfer_in", "transfer_out"],
  }).notNull(),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(), // signé (+ / -)
  reference: text("reference"), // id de vente / achat / retour / ajustement
  userId: text("user_id").references(() => users.id),
  terminalId: text("terminal_id").references(() => terminals.id),
  reason: text("reason"),
  ...syncColumns,
});

// ---------------------------------------------------------------------------
// Tiers
// ---------------------------------------------------------------------------

export const customers = pgTable("customers", {
  id: ulidPk(),
  storeId: text("store_id").notNull().references(() => stores.id),
  branchId: text("branch_id").references(() => branches.id),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  loyaltyPoints: integer("loyalty_points").notNull().default(0),
  creditBalance: numeric("credit_balance", { precision: 14, scale: 2 }).notNull().default("0"),
  ...syncColumns,
});

export const suppliers = pgTable("suppliers", {
  id: ulidPk(),
  storeId: text("store_id").notNull().references(() => stores.id),
  branchId: text("branch_id").references(() => branches.id),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  ...syncColumns,
});

// ---------------------------------------------------------------------------
// Ventes
// ---------------------------------------------------------------------------

export const sales = pgTable(
  "sales",
  {
    id: ulidPk(),
    storeId: text("store_id").notNull().references(() => stores.id),
    branchId: text("branch_id").notNull().references(() => branches.id),
    terminalId: text("terminal_id").references(() => terminals.id),
    customerId: text("customer_id").references(() => customers.id),
    userId: text("user_id").notNull().references(() => users.id),
    cashRegisterId: text("cash_register_id"),
    number: text("number").notNull(),
    status: text("status", { enum: ["completed", "voided", "held"] }).notNull().default("completed"),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull(),
    discountTotal: numeric("discount_total", { precision: 14, scale: 2 }).notNull().default("0"),
    taxTotal: numeric("tax_total", { precision: 14, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 14, scale: 2 }).notNull(),
    amountPaid: numeric("amount_paid", { precision: 14, scale: 2 }).notNull().default("0"),
    changeDue: numeric("change_due", { precision: 14, scale: 2 }).notNull().default("0"),
    notes: text("notes"),
    clientOpId: text("client_op_id"), // ULID côté client pour idempotence
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    numberUnique: uniqueIndex("sales_number_unique").on(t.storeId, t.number),
    clientOpUnique: uniqueIndex("sales_client_op_unique").on(t.clientOpId),
  })
);

export const saleItems = pgTable("sale_items", {
  id: ulidPk(),
  saleId: text("sale_id").notNull().references(() => sales.id),
  productId: text("product_id").notNull().references(() => products.id),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 14, scale: 2 }).notNull().default("0"),
  taxAmount: numeric("tax_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 14, scale: 2 }).notNull(),
  ...syncColumns,
});

export const payments = pgTable("payments", {
  id: ulidPk(),
  storeId: text("store_id").notNull().references(() => stores.id),
  branchId: text("branch_id").notNull().references(() => branches.id),
  saleId: text("sale_id").references(() => sales.id),
  method: text("method", {
    enum: ["cash", "card", "mobile_money", "credit", "check", "bank_transfer"],
  }).notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  reference: text("reference"),
  userId: text("user_id").references(() => users.id),
  terminalId: text("terminal_id").references(() => terminals.id),
  ...syncColumns,
});

export const returns = pgTable(
  "returns",
  {
    id: ulidPk(),
    storeId: text("store_id").notNull().references(() => stores.id),
    branchId: text("branch_id").notNull().references(() => branches.id),
    saleId: text("sale_id").notNull().references(() => sales.id),
    userId: text("user_id").notNull().references(() => users.id),
    terminalId: text("terminal_id").references(() => terminals.id),
    reason: text("reason"),
    total: numeric("total", { precision: 14, scale: 2 }).notNull(),
    clientOpId: text("client_op_id"),
    ...syncColumns,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({ clientOpUnique: uniqueIndex("returns_client_op_unique").on(t.clientOpId) })
);

export const returnItems = pgTable("return_items", {
  id: ulidPk(),
  returnId: text("return_id").notNull().references(() => returns.id),
  saleItemId: text("sale_item_id").notNull().references(() => saleItems.id),
  productId: text("product_id").notNull().references(() => products.id),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  ...syncColumns,
});

// ---------------------------------------------------------------------------
// Achats & dépenses
// ---------------------------------------------------------------------------

export const purchases = pgTable("purchases", {
  id: ulidPk(),
  storeId: text("store_id").notNull().references(() => stores.id),
  branchId: text("branch_id").notNull().references(() => branches.id),
  supplierId: text("supplier_id").references(() => suppliers.id),
  userId: text("user_id").references(() => users.id),
  number: text("number").notNull(),
  status: text("status", { enum: ["pending", "received", "cancelled"] }).notNull().default("received"),
  total: numeric("total", { precision: 14, scale: 2 }).notNull(),
  ...syncColumns,
});

export const purchaseItems = pgTable("purchase_items", {
  id: ulidPk(),
  purchaseId: text("purchase_id").notNull().references(() => purchases.id),
  productId: text("product_id").notNull().references(() => products.id),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
  unitCost: numeric("unit_cost", { precision: 14, scale: 2 }).notNull(),
  total: numeric("total", { precision: 14, scale: 2 }).notNull(),
  ...syncColumns,
});

export const expenses = pgTable("expenses", {
  id: ulidPk(),
  storeId: text("store_id").notNull().references(() => stores.id),
  branchId: text("branch_id").notNull().references(() => branches.id),
  userId: text("user_id").references(() => users.id),
  category: text("category").notNull(),
  description: text("description"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  cashRegisterId: text("cash_register_id"),
  ...syncColumns,
});

// ---------------------------------------------------------------------------
// Caisse
// ---------------------------------------------------------------------------

export const cashRegisters = pgTable("cash_registers", {
  id: ulidPk(),
  storeId: text("store_id").notNull().references(() => stores.id),
  branchId: text("branch_id").notNull().references(() => branches.id),
  terminalId: text("terminal_id").references(() => terminals.id),
  userId: text("user_id").notNull().references(() => users.id),
  openingBalance: numeric("opening_balance", { precision: 14, scale: 2 }).notNull().default("0"),
  expectedClosingBalance: numeric("expected_closing_balance", { precision: 14, scale: 2 }),
  actualClosingBalance: numeric("actual_closing_balance", { precision: 14, scale: 2 }),
  difference: numeric("difference", { precision: 14, scale: 2 }),
  status: text("status", { enum: ["open", "closed"] }).notNull().default("open"),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  ...syncColumns,
});

export const cashMovements = pgTable("cash_movements", {
  id: ulidPk(),
  cashRegisterId: text("cash_register_id").notNull().references(() => cashRegisters.id),
  type: text("type", { enum: ["cash_in", "cash_out", "sale", "return", "expense"] }).notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  reason: text("reason"),
  userId: text("user_id").references(() => users.id),
  ...syncColumns,
});

// ---------------------------------------------------------------------------
// Journalisation, synchronisation, configuration, licences
// ---------------------------------------------------------------------------

export const auditLogs = pgTable("audit_logs", {
  id: ulidPk(),
  storeId: text("store_id").references(() => stores.id),
  userId: text("user_id").references(() => users.id),
  terminalId: text("terminal_id").references(() => terminals.id),
  action: text("action", { enum: ["create", "update", "delete"] }).notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull(),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const syncOperations = pgTable(
  "sync_operations",
  {
    id: ulidPk(),
    clientOpId: text("client_op_id").notNull(),
    terminalId: text("terminal_id").references(() => terminals.id),
    userId: text("user_id").references(() => users.id),
    entity: text("entity").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action", { enum: ["create", "update", "delete"] }).notNull(),
    payload: jsonb("payload"),
    status: text("status", { enum: ["applied", "conflict", "rejected"] }).notNull().default("applied"),
    conflictDetails: jsonb("conflict_details"),
    appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    clientOpUnique: uniqueIndex("sync_operations_client_op_unique").on(t.terminalId, t.clientOpId),
  })
);

export const settings = pgTable(
  "settings",
  {
    id: ulidPk(),
    storeId: text("store_id").references(() => stores.id),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    ...syncColumns,
  },
  (t) => ({ storeKeyUnique: uniqueIndex("settings_store_key_unique").on(t.storeId, t.key) })
);

export const licenses = pgTable("licenses", {
  id: ulidPk(),
  storeId: text("store_id").notNull().references(() => stores.id),
  licenseKey: text("license_key").notNull(),
  plan: text("plan").notNull().default("standard"),
  maxTerminals: integer("max_terminals").notNull().default(10),
  maxDisplays: integer("max_displays").notNull().default(6),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  ...syncColumns,
});

export const allTables = {
  stores,
  branches,
  terminals,
  roles,
  permissions,
  rolePermissions,
  users,
  sessions,
  brands,
  categories,
  units,
  products,
  taxes,
  discounts,
  inventory,
  inventoryMovements,
  customers,
  suppliers,
  sales,
  saleItems,
  payments,
  returns,
  returnItems,
  purchases,
  purchaseItems,
  expenses,
  cashRegisters,
  cashMovements,
  auditLogs,
  syncOperations,
  settings,
  licenses,
};

export { sql };
