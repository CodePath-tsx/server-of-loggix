/**
 * Carte des permissions par rôle. Chaque permission suit le format `ressource.action`.
 * Le rôle "owner" possède implicitement toutes les permissions (contrôlé dans le middleware RBAC).
 */
export const ROLES = ["owner", "admin", "manager", "cashier", "stock_manager", "accountant"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "users.manage",
  "products.view",
  "products.create",
  "products.update",
  "products.delete",
  "categories.manage",
  "inventory.view",
  "inventory.adjust",
  "sales.create",
  "sales.view",
  "sales.void",
  "returns.create",
  "returns.view",
  "customers.manage",
  "suppliers.manage",
  "purchases.manage",
  "payments.view",
  "reports.view",
  "settings.manage",
  "cash_register.manage",
  "sync.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Permissions accordées à chaque rôle (hors owner, qui a tout). */
export const ROLE_PERMISSIONS: Record<Exclude<Role, "owner">, Permission[]> = {
  admin: [...PERMISSIONS],
  manager: [
    "products.view",
    "products.create",
    "products.update",
    "categories.manage",
    "inventory.view",
    "inventory.adjust",
    "sales.create",
    "sales.view",
    "sales.void",
    "returns.create",
    "returns.view",
    "customers.manage",
    "suppliers.manage",
    "purchases.manage",
    "payments.view",
    "reports.view",
    "cash_register.manage",
  ],
  cashier: [
    "products.view",
    "inventory.view",
    "sales.create",
    "sales.view",
    "returns.create",
    "returns.view",
    "customers.manage",
    "payments.view",
    "cash_register.manage",
  ],
  stock_manager: [
    "products.view",
    "products.create",
    "products.update",
    "categories.manage",
    "inventory.view",
    "inventory.adjust",
    "suppliers.manage",
    "purchases.manage",
    "reports.view",
  ],
  accountant: [
    "products.view",
    "sales.view",
    "returns.view",
    "payments.view",
    "reports.view",
    "purchases.manage",
    "settings.manage",
  ],
};

export function roleHasPermission(role: Role, permission: Permission): boolean {
  if (role === "owner") return true;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
