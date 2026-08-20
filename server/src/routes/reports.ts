/**
 * Rapports consolidés : ventes par jour, meilleurs produits, stock faible,
 * synthèse de trésorerie. Toutes les données sont agrégées côté serveur central.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, desc, eq, gte, lte, sql, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { sales, saleItems, products, inventory, payments, expenses } from "../db/schema.js";
import { authenticate } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";

const rangeSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

function parseRange(query: unknown) {
  const { from, to } = rangeSchema.parse(query);
  const start = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const end = to ? new Date(to) : new Date();
  return { start, end };
}

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  // Synthèse générale du magasin sur une période
  app.get(
    "/api/reports/summary",
    { preHandler: [authenticate, requirePermission("reports.view")] },
    async (request, reply) => {
      const auth = request.auth!;
      const { start, end } = parseRange(request.query);

      const [totals] = await db
        .select({
          ventes: sql<number>`coalesce(sum(${sales.total}), 0)`,
          nombre: sql<number>`count(*)`,
          remises: sql<number>`coalesce(sum(${sales.discountTotal}), 0)`,
          taxes: sql<number>`coalesce(sum(${sales.taxTotal}), 0)`,
        })
        .from(sales)
        .where(
          and(
            eq(sales.storeId, auth.storeId),
            eq(sales.status, "completed"),
            isNull(sales.deletedAt),
            gte(sales.createdAt, start),
            lte(sales.createdAt, end),
          ),
        );

      const [depenses] = await db
        .select({ total: sql<number>`coalesce(sum(${expenses.amount}), 0)` })
        .from(expenses)
        .where(
          and(eq(expenses.storeId, auth.storeId), gte(expenses.createdAt, start), lte(expenses.createdAt, end)),
        );

      const parMode = await db
        .select({ methode: payments.method, total: sql<number>`coalesce(sum(${payments.amount}), 0)` })
        .from(payments)
        .where(
          and(eq(payments.storeId, auth.storeId), gte(payments.createdAt, start), lte(payments.createdAt, end)),
        )
        .groupBy(payments.method);

      return reply.send({
        periode: { debut: start.toISOString(), fin: end.toISOString() },
        chiffreAffaires: Number(totals?.ventes ?? 0),
        nombreVentes: Number(totals?.nombre ?? 0),
        remises: Number(totals?.remises ?? 0),
        taxes: Number(totals?.taxes ?? 0),
        depenses: Number(depenses?.total ?? 0),
        resultatNet: Number(totals?.ventes ?? 0) - Number(depenses?.total ?? 0),
        paiementsParMode: parMode.map((p) => ({ methode: p.methode, total: Number(p.total) })),
      });
    },
  );

  // Ventes agrégées par jour
  app.get(
    "/api/reports/sales-by-day",
    { preHandler: [authenticate, requirePermission("reports.view")] },
    async (request, reply) => {
      const auth = request.auth!;
      const { start, end } = parseRange(request.query);

      const rows = await db
        .select({
          jour: sql<string>`to_char(${sales.createdAt}, 'YYYY-MM-DD')`,
          total: sql<number>`coalesce(sum(${sales.total}), 0)`,
          nombre: sql<number>`count(*)`,
        })
        .from(sales)
        .where(
          and(
            eq(sales.storeId, auth.storeId),
            eq(sales.status, "completed"),
            isNull(sales.deletedAt),
            gte(sales.createdAt, start),
            lte(sales.createdAt, end),
          ),
        )
        .groupBy(sql`to_char(${sales.createdAt}, 'YYYY-MM-DD')`)
        .orderBy(sql`to_char(${sales.createdAt}, 'YYYY-MM-DD')`);

      return reply.send({
        jours: rows.map((r) => ({ jour: r.jour, total: Number(r.total), nombre: Number(r.nombre) })),
      });
    },
  );

  // Meilleurs produits vendus
  app.get(
    "/api/reports/top-products",
    { preHandler: [authenticate, requirePermission("reports.view")] },
    async (request, reply) => {
      const auth = request.auth!;
      const { start, end } = parseRange(request.query);
      const { limit } = z.object({ limit: z.coerce.number().int().max(100).default(10) }).parse(request.query);

      const rows = await db
        .select({
          produitId: saleItems.productId,
          nom: products.name,
          quantite: sql<number>`coalesce(sum(${saleItems.quantity}), 0)`,
          total: sql<number>`coalesce(sum(${saleItems.total}), 0)`,
        })
        .from(saleItems)
        .innerJoin(sales, eq(saleItems.saleId, sales.id))
        .innerJoin(products, eq(saleItems.productId, products.id))
        .where(
          and(
            eq(sales.storeId, auth.storeId),
            eq(sales.status, "completed"),
            gte(sales.createdAt, start),
            lte(sales.createdAt, end),
          ),
        )
        .groupBy(saleItems.productId, products.name)
        .orderBy(desc(sql`sum(${saleItems.total})`))
        .limit(limit);

      return reply.send({
        produits: rows.map((r) => ({
          produitId: r.produitId,
          nom: r.nom,
          quantite: Number(r.quantite),
          total: Number(r.total),
        })),
      });
    },
  );

  // Produits en stock faible ou en rupture
  app.get(
    "/api/reports/low-stock",
    { preHandler: [authenticate, requirePermission("inventory.view")] },
    async (request, reply) => {
      const auth = request.auth!;
      const rows = await db
        .select({
          produitId: products.id,
          nom: products.name,
          sku: products.sku,
          quantite: inventory.quantity,
          seuil: products.lowStockThreshold,
        })
        .from(inventory)
        .innerJoin(products, eq(inventory.productId, products.id))
        .where(
          and(
            eq(inventory.storeId, auth.storeId),
            sql`${inventory.quantity}::numeric <= ${products.lowStockThreshold}::numeric`,
          ),
        )
        .orderBy(inventory.quantity)
        .limit(200);

      return reply.send({
        produits: rows.map((r) => ({
          produitId: r.produitId,
          nom: r.nom,
          sku: r.sku,
          quantite: Number(r.quantite),
          seuil: r.seuil,
          etat: Number(r.quantite) <= 0 ? "rupture" : "stock_faible",
        })),
      });
    },
  );
}
