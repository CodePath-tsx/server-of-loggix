/**
 * Gestion des licences multi-terminaux : consultation, activation et
 * vérification du nombre de postes / afficheurs autorisés.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import crypto from "node:crypto";
import { db } from "../db/index.js";
import { licenses, terminals } from "../db/schema.js";
import { authenticate } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { AppError, NotFoundError } from "../lib/errors.js";
import { writeAuditLog } from "../lib/audit.js";

const activateSchema = z.object({
  licenseKey: z.string().min(8, "Clé de licence invalide"),
  plan: z.enum(["standard", "pro", "enterprise"]).default("standard"),
  maxTerminals: z.coerce.number().int().min(1).max(50).optional(),
  maxDisplays: z.coerce.number().int().min(0).max(30).optional(),
  expiresAt: z.string().datetime().optional(),
});

const PLAN_LIMITS: Record<string, { maxTerminals: number; maxDisplays: number }> = {
  standard: { maxTerminals: 3, maxDisplays: 2 },
  pro: { maxTerminals: 10, maxDisplays: 6 },
  enterprise: { maxTerminals: 50, maxDisplays: 30 },
};

/** Clé de licence lisible : LGX-XXXX-XXXX-XXXX. */
export function generateLicenseKey(): string {
  const block = () => crypto.randomBytes(2).toString("hex").toUpperCase();
  return `LGX-${block()}-${block()}-${block()}`;
}

export async function licenseRoutes(app: FastifyInstance): Promise<void> {
  const guard = { preHandler: [authenticate, requirePermission("settings.manage")] };

  // État de la licence courante + utilisation réelle des terminaux
  app.get("/api/licenses/current", { preHandler: [authenticate] }, async (request, reply) => {
    const storeId = request.auth!.storeId;
    const [license] = await db
      .select()
      .from(licenses)
      .where(and(eq(licenses.storeId, storeId), eq(licenses.isActive, true)))
      .limit(1);

    const active = await db
      .select({ id: terminals.id, type: terminals.type })
      .from(terminals)
      .where(and(eq(terminals.storeId, storeId), eq(terminals.isActive, true)));

    const usedPos = active.filter((t) => t.type === "pos").length;
    const usedDisplays = active.filter((t) => t.type === "display").length;
    const expired = Boolean(license?.expiresAt && license.expiresAt.getTime() < Date.now());

    return reply.send({
      license: license ?? null,
      usage: {
        postes: usedPos,
        postesMax: license?.maxTerminals ?? 0,
        afficheurs: usedDisplays,
        afficheursMax: license?.maxDisplays ?? 0,
      },
      statut: !license ? "aucune" : expired ? "expiree" : "active",
    });
  });

  // Activation ou mise à jour d'une licence
  app.post("/api/licenses/activate", guard, async (request, reply) => {
    const body = activateSchema.parse(request.body);
    const storeId = request.auth!.storeId;
    const limits = PLAN_LIMITS[body.plan]!;
    const values = {
      storeId,
      licenseKey: body.licenseKey,
      plan: body.plan,
      maxTerminals: body.maxTerminals ?? limits.maxTerminals,
      maxDisplays: body.maxDisplays ?? limits.maxDisplays,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      isActive: true,
      updatedAt: new Date(),
    };

    const [existing] = await db
      .select()
      .from(licenses)
      .where(eq(licenses.storeId, storeId))
      .limit(1);

    let license;
    if (existing) {
      [license] = await db
        .update(licenses)
        .set({ ...values, version: existing.version + 1 })
        .where(eq(licenses.id, existing.id))
        .returning();
    } else {
      [license] = await db.insert(licenses).values(values).returning();
    }

    await writeAuditLog({
      actor: request.auth ?? null,
      action: existing ? "update" : "create",
      entity: "license",
      entityId: license!.id,
      oldValue: existing ?? null,
      newValue: license,
    });

    return reply.send({ license, message: "Licence activée avec succès" });
  });

  // Désactivation d'une licence
  app.post("/api/licenses/deactivate", guard, async (request, reply) => {
    const storeId = request.auth!.storeId;
    const [license] = await db
      .update(licenses)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(licenses.storeId, storeId))
      .returning();
    if (!license) throw new NotFoundError("Aucune licence à désactiver pour ce magasin");
    return reply.send({ license, message: "Licence désactivée" });
  });

  // Génération d'une clé (usage administrateur / revendeur)
  app.post("/api/licenses/generate-key", guard, async (_request, reply) => {
    return reply.send({ licenseKey: generateLicenseKey() });
  });

  // Vérification côté terminal avant connexion
  app.post("/api/licenses/check", async (request, reply) => {
    const body = z.object({ licenseKey: z.string().min(1), terminalCode: z.string().optional() }).parse(request.body);
    const [license] = await db
      .select()
      .from(licenses)
      .where(and(eq(licenses.licenseKey, body.licenseKey), eq(licenses.isActive, true)))
      .limit(1);

    if (!license) throw new NotFoundError("Licence inconnue ou désactivée");
    if (license.expiresAt && license.expiresAt.getTime() < Date.now()) {
      throw new AppError("Licence expirée", 402, "LICENCE_EXPIREE");
    }

    return reply.send({
      valide: true,
      plan: license.plan,
      storeId: license.storeId,
      maxTerminals: license.maxTerminals,
      maxDisplays: license.maxDisplays,
      expiresAt: license.expiresAt,
    });
  });
}
