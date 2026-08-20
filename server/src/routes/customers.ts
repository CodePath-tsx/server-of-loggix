/**
 * Gestion des clients : liste, recherche, création, modification, suppression.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "../db/index.js";
import { customers } from "../db/schema.js";
import { authenticate } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { NotFoundError, ConflictError } from "../lib/errors.js";
import { writeAuditLog } from "../lib/audit.js";
import { wsHub } from "../lib/ws.js";

const bodySchema = z.object({
  fullName: z.string().min(1, "Le nom du client est requis"),
  phone: z.string().optional(),
  email: z.string().email("Adresse e-mail invalide").optional().or(z.literal("")),
  address: z.string().optional(),
  loyaltyPoints: z.number().int().min(0).optional(),
  creditBalance: z.string().optional(),
  version: z.number().int().optional(),
});

export async function customerRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/customers", { preHandler: authenticate }, async (request, reply) => {
    const auth = request.auth!;
    const query = z
      .object({ search: z.string().optional(), limit: z.coerce.number().int().max(500).default(200) })
      .parse(request.query);

    const filters = [eq(customers.storeId, auth.storeId)];
    if (query.search) {
      const like = `%${query.search}%`;
      filters.push(
        or(ilike(customers.fullName, like), ilike(customers.phone, like), ilike(customers.email, like))!,
      );
    }

    const rows = await db
      .select()
      .from(customers)
      .where(and(...filters))
      .orderBy(desc(customers.updatedAt))
      .limit(query.limit);

    return reply.send({ customers: rows });
  });

  app.post(
    "/api/customers",
    { preHandler: [authenticate, requirePermission("customers.manage")] },
    async (request, reply) => {
      const auth = request.auth!;
      const body = bodySchema.parse(request.body);
      const [created] = await db
        .insert(customers)
        .values({
          storeId: auth.storeId,
          branchId: auth.branchId,
          fullName: body.fullName,
          phone: body.phone,
          email: body.email || null,
          address: body.address,
          loyaltyPoints: body.loyaltyPoints ?? 0,
          creditBalance: body.creditBalance ?? "0",
        })
        .returning();

      await writeAuditLog({ actor: auth, action: "create", entity: "customers", entityId: created.id, newValue: created });
      wsHub.broadcast("user.updated", { entity: "customers", id: created.id }, auth.storeId);
      return reply.code(201).send(created);
    },
  );

  app.put(
    "/api/customers/:id",
    { preHandler: [authenticate, requirePermission("customers.manage")] },
    async (request, reply) => {
      const auth = request.auth!;
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = bodySchema.parse(request.body);

      const [existing] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
      if (!existing) throw new NotFoundError("Client introuvable");
      if (body.version !== undefined && body.version !== existing.version) {
        throw new ConflictError("Ce client a été modifié sur un autre poste", { serverVersion: existing.version });
      }

      const [updated] = await db
        .update(customers)
        .set({
          fullName: body.fullName,
          phone: body.phone,
          email: body.email || null,
          address: body.address,
          loyaltyPoints: body.loyaltyPoints ?? existing.loyaltyPoints,
          creditBalance: body.creditBalance ?? existing.creditBalance,
          version: existing.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(customers.id, id))
        .returning();

      await writeAuditLog({
        actor: auth,
        action: "update",
        entity: "customers",
        entityId: id,
        oldValue: existing,
        newValue: updated,
      });
      wsHub.broadcast("user.updated", { entity: "customers", id }, auth.storeId);
      return reply.send(updated);
    },
  );

  app.delete(
    "/api/customers/:id",
    { preHandler: [authenticate, requirePermission("customers.manage")] },
    async (request, reply) => {
      const auth = request.auth!;
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const [existing] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
      if (!existing) throw new NotFoundError("Client introuvable");

      await db.delete(customers).where(eq(customers.id, id));
      await writeAuditLog({ actor: auth, action: "delete", entity: "customers", entityId: id, oldValue: existing });
      return reply.send({ success: true });
    },
  );
}
