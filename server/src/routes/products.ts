/** Routes de gestion du catalogue produits. */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { products } from "../db/schema.js";
import { authenticate } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { writeAuditLog } from "../lib/audit.js";
import { wsHub } from "../lib/ws.js";
import { NotFoundError, ConflictError } from "../lib/errors.js";

const productSchema = z.object({
  branchId: z.string().optional(),
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  unitId: z.string().optional(),
  sku: z.string().min(1),
  barcode: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  costPrice: z.number().nonnegative(),
  sellingPrice: z.number().nonnegative(),
  taxId: z.string().optional(),
  lowStockThreshold: z.number().int().nonnegative().optional(),
});

export async function productsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/api/products", { preHandler: requirePermission("products.view") }, async (request, reply) => {
    const auth = request.auth!;
    const rows = await db.select().from(products).where(eq(products.storeId, auth.storeId));
    return reply.send(rows);
  });

  app.get("/api/products/:id", { preHandler: requirePermission("products.view") }, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const [row] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!row) throw new NotFoundError("Produit introuvable");
    return reply.send(row);
  });

  app.post("/api/products", { preHandler: requirePermission("products.create") }, async (request, reply) => {
    const auth = request.auth!;
    const body = productSchema.parse(request.body);
    const [created] = await db.insert(products).values({ ...body, storeId: auth.storeId, costPrice: String(body.costPrice), sellingPrice: String(body.sellingPrice) }).returning();
    await writeAuditLog({ actor: auth, action: "create", entity: "products", entityId: created.id, newValue: created });
    wsHub.broadcast("product.updated", created, auth.storeId);
    return reply.code(201).send(created);
  });

  app.put("/api/products/:id", { preHandler: requirePermission("products.update") }, async (request, reply) => {
    const auth = request.auth!;
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = productSchema.partial().extend({ version: z.number().int() }).parse(request.body);

    const [existing] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!existing) throw new NotFoundError("Produit introuvable");
    if (existing.version !== body.version) {
      throw new ConflictError("Le produit a été modifié entre-temps", { serverVersion: existing.version });
    }

    const { version, ...rest } = body;
    const updates: Record<string, unknown> = { ...rest, version: existing.version + 1, updatedAt: new Date() };
    if (rest.costPrice !== undefined) updates.costPrice = String(rest.costPrice);
    if (rest.sellingPrice !== undefined) updates.sellingPrice = String(rest.sellingPrice);

    const [updated] = await db.update(products).set(updates).where(eq(products.id, id)).returning();
    await writeAuditLog({ actor: auth, action: "update", entity: "products", entityId: id, oldValue: existing, newValue: updated });
    wsHub.broadcast("product.updated", updated, auth.storeId);
    return reply.send(updated);
  });

  app.delete("/api/products/:id", { preHandler: requirePermission("products.delete") }, async (request, reply) => {
    const auth = request.auth!;
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const [existing] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!existing) throw new NotFoundError("Produit introuvable");
    await db.update(products).set({ isActive: false, updatedAt: new Date(), version: existing.version + 1 }).where(eq(products.id, id));
    await writeAuditLog({ actor: auth, action: "delete", entity: "products", entityId: id, oldValue: existing });
    wsHub.broadcast("product.updated", { id, isActive: false }, auth.storeId);
    return reply.send({ success: true });
  });
}
