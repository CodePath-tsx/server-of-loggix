/**
 * Gestion des terminaux : postes de caisse POS-01…POS-10 et
 * afficheurs de prix DISPLAY-01…DISPLAY-06.
 * Le nombre de terminaux actifs est limité par la licence du magasin.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { terminals, licenses } from "../db/schema.js";
import { authenticate } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { AppError, NotFoundError } from "../lib/errors.js";
import { wsHub } from "../lib/ws.js";

export const POS_CODES = Array.from({ length: 10 }, (_, i) => `POS-${String(i + 1).padStart(2, "0")}`);
export const DISPLAY_CODES = Array.from({ length: 6 }, (_, i) => `DISPLAY-${String(i + 1).padStart(2, "0")}`);

const upsertSchema = z.object({
  code: z.string().regex(/^(POS-(0[1-9]|10)|DISPLAY-0[1-6])$/, "Code de terminal invalide"),
  type: z.enum(["pos", "display"]),
  label: z.string().optional(),
  branchId: z.string().optional(),
  ipAddress: z.string().optional(),
});

/** Vérifie que la licence autorise un terminal supplémentaire du type demandé. */
async function assertLicenseCapacity(storeId: string, type: "pos" | "display", excludeId?: string) {
  const [license] = await db
    .select()
    .from(licenses)
    .where(and(eq(licenses.storeId, storeId), eq(licenses.isActive, true)))
    .limit(1);

  const maxAllowed = type === "pos" ? (license?.maxTerminals ?? 10) : (license?.maxDisplays ?? 6);

  if (license?.expiresAt && license.expiresAt.getTime() < Date.now()) {
    throw new AppError("Licence expirée : renouvelez votre licence pour activer un terminal", 402, "LICENCE_EXPIREE");
  }

  const active = await db
    .select({ id: terminals.id })
    .from(terminals)
    .where(and(eq(terminals.storeId, storeId), eq(terminals.type, type), eq(terminals.isActive, true)));

  const count = active.filter((t) => t.id !== excludeId).length;
  if (count >= maxAllowed) {
    throw new AppError(
      `Limite de licence atteinte : ${maxAllowed} ${type === "pos" ? "postes de caisse" : "afficheurs de prix"} maximum`,
      402,
      "LIMITE_LICENCE",
    );
  }
}

export async function terminalRoutes(app: FastifyInstance): Promise<void> {
  // Liste des terminaux avec état de connexion temps réel
  app.get("/api/terminals", { preHandler: authenticate }, async (request, reply) => {
    const auth = request.auth!;
    const rows = await db.select().from(terminals).where(eq(terminals.storeId, auth.storeId));
    const online = new Set(wsHub.onlineTerminals().map((t) => t.terminalId));

    return reply.send({
      terminals: rows.map((t) => ({
        ...t,
        online: online.has(t.id),
        status: online.has(t.id)
          ? "en_ligne"
          : t.lastSeenAt && Date.now() - t.lastSeenAt.getTime() < 5 * 60_000
            ? "recent"
            : "hors_ligne",
      })),
      availableCodes: {
        pos: POS_CODES.filter((c) => !rows.some((r) => r.code === c)),
        display: DISPLAY_CODES.filter((c) => !rows.some((r) => r.code === c)),
      },
    });
  });

  // Création / mise à jour d'un terminal (admin)
  app.post(
    "/api/terminals",
    { preHandler: [authenticate, requirePermission("settings.manage")] },
    async (request, reply) => {
      const auth = request.auth!;
      const body = upsertSchema.parse(request.body);
      if (body.type === "pos" && !body.code.startsWith("POS-")) throw new AppError("Code incohérent avec le type");
      if (body.type === "display" && !body.code.startsWith("DISPLAY-")) throw new AppError("Code incohérent avec le type");

      const [existing] = await db.select().from(terminals).where(eq(terminals.code, body.code)).limit(1);
      await assertLicenseCapacity(auth.storeId, body.type, existing?.id);

      const now = new Date();
      if (existing) {
        const [updated] = await db
          .update(terminals)
          .set({
            type: body.type,
            label: body.label ?? existing.label,
            branchId: body.branchId ?? existing.branchId,
            ipAddress: body.ipAddress ?? existing.ipAddress,
            isActive: true,
            version: existing.version + 1,
            updatedAt: now,
          })
          .where(eq(terminals.id, existing.id))
          .returning();
        return reply.send(updated);
      }

      const [created] = await db
        .insert(terminals)
        .values({
          storeId: auth.storeId,
          branchId: body.branchId ?? auth.branchId,
          code: body.code,
          type: body.type,
          label: body.label,
          ipAddress: body.ipAddress,
        })
        .returning();

      return reply.code(201).send(created);
    },
  );

  // Désactivation d'un terminal (libère un emplacement de licence)
  app.delete(
    "/api/terminals/:id",
    { preHandler: [authenticate, requirePermission("settings.manage")] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const [terminal] = await db.select().from(terminals).where(eq(terminals.id, id)).limit(1);
      if (!terminal) throw new NotFoundError("Terminal introuvable");

      await db
        .update(terminals)
        .set({ isActive: false, updatedAt: new Date(), version: terminal.version + 1 })
        .where(eq(terminals.id, id));

      return reply.send({ success: true });
    },
  );

  // Battement de cœur : le terminal signale qu'il est vivant
  app.post("/api/terminals/heartbeat", { preHandler: authenticate }, async (request, reply) => {
    const auth = request.auth!;
    if (!auth.terminalId) return reply.send({ ok: true, terminalId: null });
    await db.update(terminals).set({ lastSeenAt: new Date() }).where(eq(terminals.id, auth.terminalId));
    return reply.send({ ok: true, terminalId: auth.terminalId, serverTime: new Date().toISOString() });
  });
}
