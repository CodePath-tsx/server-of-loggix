/** Routes de gestion du stock et des mouvements d'inventaire. */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and, lt, sql as dsql } from "drizzle-orm";
import { db } from "../db/index.js";
import { inventory, inventoryMovements, products } from "../db/schema.js";
import { authenticate } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { writeAuditLog } from "../lib/audit.js";
import { wsHub } from "../lib/ws.js";

const adjustSchema = z.object({
  branchId: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.number(), // signé (+ ajout / - retrait)
  reason: z.string().optional(),
});

export async function inventoryRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/api/inventory", { preHandler: requirePermission("inventory.view") }, async (request, reply) => {
    const auth = request.auth!;
    const rows = await db.select().from(inventory).where(eq(inventory.storeId, auth.storeId));
    return reply.send(rows);
  });

  app.get("/api/inventory/low-stock", { preHandler: requirePermission("inventory.view") }, async (request, reply) => {
    const auth = request.auth!;
    const rows = await db
      .select({ inventory, product: products })
      .from(inventory)
      .innerJoin(products, eq(products.id, inventory.productId))
      .where(and(eq(inventory.storeId, auth.storeId), lt(inventory.quantity, dsql`${products.lowStockThreshold}`)));
    return reply.send(rows);
  });

  app.post("/api/inventory/adjust", { preHandler: requirePermission("inventory.adjust") }, async (request, reply) => {
    const auth = request.auth!;
    const body = adjustSchema.parse(request.body);

    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(inventory)
        .where(and(eq(inventory.productId, body.productId), eq(inventory.branchId, body.branchId)))
        .limit(1);

      let row;
      if (existing) {
        [row] = await tx
          .update(inventory)
          .set({
            quantity: dsql`${inventory.quantity} + ${body.quantity}`,
            version: existing.version + 1,
            updatedAt: new Date(),
          })
          .where(eq(inventory.id, existing.id))
          .returning();
      } else {
        [row] = await tx
          .insert(inventory)
          .values({ storeId: auth.storeId, branchId: body.branchId, productId: body.productId, quantity: String(body.quantity) })
          .returning();
      }

      const [movement] = await tx
        .insert(inventoryMovements)
        .values({
          storeId: auth.storeId,
          branchId: body.branchId,
          productId: body.productId,
          type: "adjustment",
          quantity: String(body.quantity),
          userId: auth.sub,
          terminalId: auth.terminalId,
          reason: body.reason,
        })
        .returning();

      return { row, movement };
    });

    await writeAuditLog({ actor: auth, action: "update", entity: "inventory", entityId: result.row.id, newValue: result });
    wsHub.broadcast("stock.updated", result.row, auth.storeId);
    return reply.code(201).send(result);
  });

  app.get("/api/inventory/movements", { preHandler: requirePermission("inventory.view") }, async (request, reply) => {
    const auth = request.auth!;
    const rows = await db.select().from(inventoryMovements).where(eq(inventoryMovements.storeId, auth.storeId));
    return reply.send(rows);
  });
}
