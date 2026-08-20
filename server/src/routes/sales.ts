/** Routes de gestion des ventes (création transactionnelle et idempotente). */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and, gte, lte } from "drizzle-orm";
import { db } from "../db/index.js";
import { sales, saleItems, payments, inventory, inventoryMovements, products } from "../db/schema.js";
import { authenticate } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { writeAuditLog } from "../lib/audit.js";
import { wsHub } from "../lib/ws.js";
import { NotFoundError } from "../lib/errors.js";

const itemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
  taxAmount: z.number().nonnegative().default(0),
});

const paymentSchema = z.object({
  method: z.enum(["cash", "card", "mobile_money", "credit", "check", "bank_transfer"]),
  amount: z.number().nonnegative(),
  reference: z.string().optional(),
});

const createSaleSchema = z.object({
  clientOpId: z.string().min(1), // ULID généré côté client, garantit l'idempotence
  branchId: z.string().min(1),
  customerId: z.string().optional(),
  cashRegisterId: z.string().optional(),
  number: z.string().min(1),
  items: z.array(itemSchema).min(1),
  payments: z.array(paymentSchema).min(1),
  discountTotal: z.number().nonnegative().default(0),
  notes: z.string().optional(),
});

export async function salesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/api/sales", { preHandler: requirePermission("sales.view") }, async (request, reply) => {
    const auth = request.auth!;
    const query = z.object({ from: z.string().optional(), to: z.string().optional() }).parse(request.query);
    const conditions = [eq(sales.storeId, auth.storeId)];
    if (query.from) conditions.push(gte(sales.createdAt, new Date(query.from)));
    if (query.to) conditions.push(lte(sales.createdAt, new Date(query.to)));
    const rows = await db.select().from(sales).where(and(...conditions));
    return reply.send(rows);
  });

  app.get("/api/sales/:id", { preHandler: requirePermission("sales.view") }, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const [sale] = await db.select().from(sales).where(eq(sales.id, id)).limit(1);
    if (!sale) throw new NotFoundError("Vente introuvable");
    const items = await db.select().from(saleItems).where(eq(saleItems.saleId, id));
    const pays = await db.select().from(payments).where(eq(payments.saleId, id));
    return reply.send({ ...sale, items, payments: pays });
  });

  // Création d'une vente : transaction unique (vente + lignes + paiement + décrément stock + mouvement)
  app.post("/api/sales", { preHandler: requirePermission("sales.create") }, async (request, reply) => {
    const auth = request.auth!;
    const body = createSaleSchema.parse(request.body);

    // Idempotence : si l'opération a déjà été appliquée, on renvoie la vente existante
    const [existing] = await db.select().from(sales).where(eq(sales.clientOpId, body.clientOpId)).limit(1);
    if (existing) {
      const items = await db.select().from(saleItems).where(eq(saleItems.saleId, existing.id));
      const pays = await db.select().from(payments).where(eq(payments.saleId, existing.id));
      return reply.code(200).send({ ...existing, items, payments: pays, idempotent: true });
    }

    const subtotal = body.items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);
    const taxTotal = body.items.reduce((sum, it) => sum + it.taxAmount, 0);
    const total = subtotal - body.discountTotal + taxTotal;
    const amountPaid = body.payments.reduce((sum, p) => sum + p.amount, 0);
    const changeDue = Math.max(0, amountPaid - total);

    const result = await db.transaction(async (tx) => {
      const [sale] = await tx
        .insert(sales)
        .values({
          storeId: auth.storeId,
          branchId: body.branchId,
          terminalId: auth.terminalId,
          customerId: body.customerId,
          userId: auth.sub,
          cashRegisterId: body.cashRegisterId,
          number: body.number,
          subtotal: String(subtotal),
          discountTotal: String(body.discountTotal),
          taxTotal: String(taxTotal),
          total: String(total),
          amountPaid: String(amountPaid),
          changeDue: String(changeDue),
          notes: body.notes,
          clientOpId: body.clientOpId,
        })
        .returning();

      const insertedItems = [];
      for (const item of body.items) {
        const lineTotal = item.quantity * item.unitPrice - item.discount + item.taxAmount;
        const [savedItem] = await tx
          .insert(saleItems)
          .values({
            saleId: sale.id,
            productId: item.productId,
            quantity: String(item.quantity),
            unitPrice: String(item.unitPrice),
            discount: String(item.discount),
            taxAmount: String(item.taxAmount),
            total: String(lineTotal),
          })
          .returning();
        insertedItems.push(savedItem);

        // Décrément du stock
        const [existingInv] = await tx
          .select()
          .from(inventory)
          .where(and(eq(inventory.productId, item.productId), eq(inventory.branchId, body.branchId)))
          .limit(1);

        if (existingInv) {
          await tx
            .update(inventory)
            .set({
              quantity: String(Number(existingInv.quantity) - item.quantity),
              version: existingInv.version + 1,
              updatedAt: new Date(),
            })
            .where(eq(inventory.id, existingInv.id));
        } else {
          await tx.insert(inventory).values({
            storeId: auth.storeId,
            branchId: body.branchId,
            productId: item.productId,
            quantity: String(-item.quantity),
          });
        }

        await tx.insert(inventoryMovements).values({
          storeId: auth.storeId,
          branchId: body.branchId,
          productId: item.productId,
          type: "sale",
          quantity: String(-item.quantity),
          reference: sale.id,
          userId: auth.sub,
          terminalId: auth.terminalId,
        });
      }

      const insertedPayments = [];
      for (const payment of body.payments) {
        const [savedPayment] = await tx
          .insert(payments)
          .values({
            storeId: auth.storeId,
            branchId: body.branchId,
            saleId: sale.id,
            method: payment.method,
            amount: String(payment.amount),
            reference: payment.reference,
            userId: auth.sub,
            terminalId: auth.terminalId,
          })
          .returning();
        insertedPayments.push(savedPayment);
      }

      return { sale, items: insertedItems, payments: insertedPayments };
    });

    await writeAuditLog({ actor: auth, action: "create", entity: "sales", entityId: result.sale.id, newValue: result.sale });
    wsHub.broadcast("sale.created", result, auth.storeId);
    for (const item of result.items) {
      wsHub.broadcast("stock.updated", { productId: item.productId, branchId: body.branchId }, auth.storeId);
    }
    for (const payment of result.payments) {
      wsHub.broadcast("payment.created", payment, auth.storeId);
    }

    return reply.code(201).send(result);
  });

  app.post("/api/sales/:id/void", { preHandler: requirePermission("sales.void") }, async (request, reply) => {
    const auth = request.auth!;
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const [existing] = await db.select().from(sales).where(eq(sales.id, id)).limit(1);
    if (!existing) throw new NotFoundError("Vente introuvable");
    const [updated] = await db
      .update(sales)
      .set({ status: "voided", version: existing.version + 1, updatedAt: new Date() })
      .where(eq(sales.id, id))
      .returning();
    await writeAuditLog({ actor: auth, action: "update", entity: "sales", entityId: id, oldValue: existing, newValue: updated });
    return reply.send(updated);
  });
}
