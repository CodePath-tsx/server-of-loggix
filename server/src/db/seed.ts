/**
 * Initialisation de la base : magasin, succursale, rôles, permissions,
 * compte propriétaire, licence, terminaux POS-01…POS-10 et DISPLAY-01…DISPLAY-06.
 * Ce script est idempotent : il peut être relancé sans dupliquer les données.
 */
import { eq } from "drizzle-orm";
import { db, pool } from "./index.js";
import {
  stores,
  branches,
  roles,
  permissions,
  rolePermissions,
  users,
  terminals,
  licenses,
  units,
  categories,
  settings,
} from "./schema.js";
import { PERMISSIONS, ROLES, ROLE_PERMISSIONS, type Role } from "../lib/permissions.js";
import { hashPassword } from "../lib/password.js";
import { env } from "../config/env.js";

const POS_CODES = Array.from({ length: 10 }, (_, i) => `POS-${String(i + 1).padStart(2, "0")}`);
const DISPLAY_CODES = Array.from({ length: 6 }, (_, i) => `DISPLAY-${String(i + 1).padStart(2, "0")}`);

async function seed(): Promise<void> {
  console.log("🌱 Initialisation de la base de données…");

  // Magasin ------------------------------------------------------------
  let [store] = await db.select().from(stores).limit(1);
  if (!store) {
    [store] = await db
      .insert(stores)
      .values({
        name: "Mon Magasin",
        legalName: "Mon Magasin SARL",
        currency: "XOF",
      })
      .returning();
    console.log("• Magasin créé");
  }

  // Succursale principale ----------------------------------------------
  let [branch] = await db.select().from(branches).where(eq(branches.storeId, store!.id)).limit(1);
  if (!branch) {
    [branch] = await db
      .insert(branches)
      .values({ storeId: store!.id, name: "Succursale principale", isMain: true })
      .returning();
    console.log("• Succursale principale créée");
  }

  // Rôles ---------------------------------------------------------------
  const roleIds = new Map<Role, string>();
  for (const name of ROLES) {
    const [existing] = await db.select().from(roles).where(eq(roles.name, name)).limit(1);
    if (existing) {
      roleIds.set(name, existing.id);
    } else {
      const [created] = await db.insert(roles).values({ name }).returning();
      roleIds.set(name, created!.id);
    }
  }
  console.log(`• ${roleIds.size} rôles disponibles`);

  // Permissions ---------------------------------------------------------
  const permissionIds = new Map<string, string>();
  for (const code of PERMISSIONS) {
    const [existing] = await db.select().from(permissions).where(eq(permissions.code, code)).limit(1);
    if (existing) {
      permissionIds.set(code, existing.id);
    } else {
      const [created] = await db.insert(permissions).values({ code }).returning();
      permissionIds.set(code, created!.id);
    }
  }

  // Association rôles ↔ permissions -------------------------------------
  for (const role of ROLES) {
    const codes = role === "owner" ? [...PERMISSIONS] : ROLE_PERMISSIONS[role];
    for (const code of codes) {
      await db
        .insert(rolePermissions)
        .values({ roleId: roleIds.get(role)!, permissionId: permissionIds.get(code)! })
        .onConflictDoNothing();
    }
  }
  console.log("• Permissions associées aux rôles");

  // Compte propriétaire --------------------------------------------------
  const [owner] = await db.select().from(users).where(eq(users.username, "proprietaire")).limit(1);
  if (!owner) {
    await db.insert(users).values({
      storeId: store!.id,
      branchId: branch!.id,
      roleId: roleIds.get("owner")!,
      fullName: "Propriétaire",
      username: "proprietaire",
      passwordHash: await hashPassword(env.OWNER_DEFAULT_PASSWORD),
      mustChangePassword: true,
    });
    console.log(`• Compte propriétaire créé (identifiant : proprietaire / mot de passe : ${env.OWNER_DEFAULT_PASSWORD})`);
  }

  // Licence --------------------------------------------------------------
  const [license] = await db.select().from(licenses).where(eq(licenses.storeId, store!.id)).limit(1);
  if (!license) {
    await db.insert(licenses).values({
      storeId: store!.id,
      licenseKey: "LGX-DEMO-0000-0001",
      plan: "pro",
      maxTerminals: 10,
      maxDisplays: 6,
    });
    console.log("• Licence « pro » activée (10 caisses / 6 afficheurs)");
  }

  // Terminaux -------------------------------------------------------------
  for (const code of [...POS_CODES, ...DISPLAY_CODES]) {
    const [existing] = await db.select().from(terminals).where(eq(terminals.code, code)).limit(1);
    if (!existing) {
      await db.insert(terminals).values({
        storeId: store!.id,
        branchId: branch!.id,
        code,
        type: code.startsWith("POS") ? "pos" : "display",
        label: code.startsWith("POS") ? `Caisse ${code.slice(-2)}` : `Afficheur de prix ${code.slice(-2)}`,
        isActive: false,
      });
    }
  }
  console.log(`• ${POS_CODES.length} caisses et ${DISPLAY_CODES.length} afficheurs enregistrés`);

  // Unités et catégories de base -------------------------------------------
  const baseUnits = [
    { name: "Pièce", symbol: "pce" },
    { name: "Kilogramme", symbol: "kg" },
    { name: "Litre", symbol: "L" },
    { name: "Carton", symbol: "ctn" },
  ];
  for (const unit of baseUnits) {
    const [existing] = await db.select().from(units).where(eq(units.symbol, unit.symbol)).limit(1);
    if (!existing) await db.insert(units).values({ ...unit, storeId: store!.id, branchId: branch!.id });
  }

  const baseCategories = ["Alimentation", "Boissons", "Hygiène", "Entretien", "Divers"];
  for (const name of baseCategories) {
    const [existing] = await db.select().from(categories).where(eq(categories.name, name)).limit(1);
    if (!existing) await db.insert(categories).values({ name, storeId: store!.id, branchId: branch!.id });
  }
  console.log("• Unités et catégories de base créées");

  // Paramètres par défaut ----------------------------------------------------
  const defaultSettings: Array<{ key: string; value: unknown }> = [
    { key: "langue", value: "fr" },
    { key: "devise", value: "XOF" },
    { key: "tva_par_defaut", value: 18 },
    { key: "impression_ticket", value: { largeur: 80, entete: "Mon Magasin", pied: "Merci de votre visite" } },
  ];
  for (const item of defaultSettings) {
    await db
      .insert(settings)
      .values({ storeId: store!.id, key: item.key, value: item.value as never })
      .onConflictDoNothing();
  }

  console.log("✅ Initialisation terminée.");
}

seed()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("❌ Échec de l'initialisation :", error);
    await pool.end();
    process.exit(1);
  });
