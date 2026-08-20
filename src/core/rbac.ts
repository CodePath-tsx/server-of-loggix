/**
 * Dynamic RBAC. The canonical list of permissions the app knows about; roles
 * are user-defined at runtime and stored in the DB (roles + role_permissions).
 * Every IPC handler MUST call `assertPermission(session, perm)` before doing
 * work — the UI hides menus but the backend is what actually enforces.
 */
import { PermissionError } from "./errors";

export const PERMISSIONS = {
  "pos.use": "Utiliser le point de vente",
  "sales.view": "Voir les ventes",
  "sales.refund": "Rembourser les ventes",
  "sales.discount": "Appliquer des remises",
  "products.view": "Voir les produits",
  "products.create": "Ajouter des produits",
  "products.update": "Modifier les produits",
  "products.delete": "Supprimer les produits",
  "categories.manage": "Gérer les catégories",
  "stock.view": "Voir le stock",
  "stock.adjust": "Ajuster le stock",
  "stock.transfer": "Transférer le stock entre succursales",
  "movements.view": "Voir les mouvements de stock",
  "customers.view": "Voir les clients",
  "customers.manage": "Gérer les clients",
  "suppliers.view": "Voir les fournisseurs",
  "suppliers.manage": "Gérer les fournisseurs",
  "expenses.view": "Voir les dépenses",
  "expenses.manage": "Gérer les dépenses",
  "reports.view": "Voir les rapports",
  "reports.export": "Exporter les rapports",
  "users.manage": "Gérer les utilisateurs",
  "roles.manage": "Gérer les rôles et permissions",
  "settings.manage": "Gérer les paramètres",
  "license.manage": "Gérer la licence",
  "backup.manage": "Sauvegarde et restauration",
  "audit.view": "Voir le journal d'audit",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

/** Preset roles seeded on first boot; users can create more from the UI. */
export const PRESET_ROLES: { name: string; description: string; permissions: Permission[] }[] = [
  { name: "Administrator", description: "Permissions complètes", permissions: ALL_PERMISSIONS },
  { name: "Manager", description: "Gestion quotidienne",
    permissions: ALL_PERMISSIONS.filter((p) =>
      !["users.manage","roles.manage","license.manage","audit.view"].includes(p)) },
  { name: "Cashier", description: "Point de vente uniquement",
    permissions: ["pos.use","sales.view","customers.view","customers.manage","products.view"] },
  { name: "Warehouse", description: "Stock",
    permissions: ["products.view","stock.view","stock.adjust","stock.transfer","movements.view","suppliers.view"] },
  { name: "Supervisor", description: "Supervision",
    permissions: ["pos.use","sales.view","sales.refund","sales.discount","products.view","stock.view","movements.view","reports.view","customers.view"] },
  { name: "Accountant", description: "Comptabilité",
    permissions: ["sales.view","expenses.view","expenses.manage","reports.view","reports.export","customers.view","suppliers.view"] },
];

export interface SessionLike { role?: string; permissions?: readonly Permission[]; }

export function hasPerm(session: SessionLike | null | undefined, perm: Permission): boolean {
  if (!session?.permissions) return false;
  return session.permissions.includes(perm);
}

export function assertPermission(session: SessionLike | null | undefined, perm: Permission): void {
  if (!hasPerm(session, perm)) throw new PermissionError(perm);
}
