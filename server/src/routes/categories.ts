/** Routes de gestion des catégories de produits. */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { categories } from "../db/schema.js";
import { authenticate } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { NotFoundError } from "../lib/errors.js";

const schema = z.object({ name: z.string().min(1), parentId: z.string().optional(), branchId: z.string().optional() });

export async function categoriesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/api/categories", { preHandler: requirePermission("categories.manage") }, async (request, reply) => {
    const rows = await db.select().from(categories).where(eq(categories.storeId, request.auth!.storeId));
    return reply.send(rows);
  });

  app.post("/api/categories", { preHandler: requirePermission("categories.manage") }, async (request, reply) => {
    const body = schema.parse(request.body);
    const [created] = await db.insert(categories).values({ ...body, storeId: request.auth!.storeId }).returning();
    return reply.code(201).send(created);
  });

  app.put("/api/categories/:id", { preHandler: requirePermission("categories.manage") }, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = schema.partial().parse(request.body);
    const [existing] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
    if (!existing) throw new NotFoundError("Catégorie introuvable");
    const [updated] = await db.update(categories).set({ ...body, version: existing.version + 1, updatedAt: new Date() }).where(eq(categories.id, id)).returning();
    return reply.send(updated);
  });

  app.delete("/api/categories/:id", { preHandler: requirePermission("categories.manage") }, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    await db.delete(categories).where(eq(categories.id, id));
    return reply.send({ success: true });
  });
}
