/**
 * Moteur de synchronisation : /api/sync
 *
 * - POST /api/sync/push : le terminal envoie sa file d'opérations en attente.
 *   Chaque opération est idempotente (clientOpId ULID) et résout les conflits
 *   par comparaison de version (Last-Write-Wins avec journalisation du conflit).
 * - GET  /api/sync/pull : le terminal récupère toutes les entités modifiées
 *   depuis un curseur temporel (updatedAt).
 * - GET  /api/sync/status : état du serveur, horloge, terminaux en ligne.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  syncOperations,
  products,
  categories,
  customers,
  suppliers,
  inventory,
  sales,
  saleItems,
  payments,
  settings,
  terminals,
} from "../db/schema.js";
import { authenticate } from "../middleware/auth.js";
import { wsHub, type WsEventType } from "../lib/ws.js";
import { writeAuditLog } from "../lib/audit.js";
import { AppError } from "../lib/errors.js";

/** Tables synchronisables exposées au client. */
const SYNCABLE = {
  products,
  categories,
  customers,
  suppliers,
  inventory,
  sales,
  sale_items: saleItems,
  payments,
  settings,
} as const;

type SyncEntity = keyof typeof SYNCABLE;

const WS_EVENT_BY_ENTITY: Partial<Record<SyncEntity, WsEventType>> = {
  products: "product.updated",
  inventory: "stock.updated",
  sales: "sale.created",
  payments: "payment.created",
  settings: "settings.updated",
};

const operationSchema = z.object({
  clientOpId: z.string().min(1),
  entity: z.enum(Object.keys(SYNCABLE) as [SyncEntity, ...SyncEntity[]]),
  entityId: z.string().min(1),
  action: z.enum(["create", "update", "delete"]),
  /** Version connue du client au moment de la modification (détection de conflit). */
  baseVersion: z.number().int().nonnegative().optional(),
  payload: z.record(z.unknown()).optional(),
  createdAt: z.string().optional(),
});

const pushSchema = z.object({
  terminalCode: z.string().optional(),
  operations: z.array(operationSchema).max(500),
});

const pullSchema = z.object({
  since: z.string().optional(),
  entities: z.string().optional(),
});

export type SyncOperationInput = z.infer<typeof operationSchema>;

export async function syncRoutes(app: FastifyInstance): Promise<void> {
  // -------------------------------------------------------------------------
  // Envoi des opérations locales (mode hors-ligne rattrapé)
  // -------------------------------------------------------------------------
  app.post("/api/sync/push", { preHandler: authenticate }, async (request, reply) => {
    const auth = request.auth!;
    const body = pushSchema.parse(request.body);

    const results: Array<{
      clientOpId: string;
      status: "applied" | "duplicate" | "conflict" | "rejected";
      entityId: string;
      serverVersion?: number;
      message?: string;
    }> = [];

    for (const op of body.operations) {
      // Idempotence : une opération déjà traitée n'est jamais rejouée.
      const [already] = await db
        .select({ id: syncOperations.id, status: syncOperations.status })
        .from(syncOperations)
        .where(
          and(
            eq(syncOperations.clientOpId, op.clientOpId),
            auth.terminalId
              ? eq(syncOperations.terminalId, auth.terminalId)
              : sql`${syncOperations.terminalId} is null`,
          ),
        )
        .limit(1);

      if (already) {
        results.push({ clientOpId: op.clientOpId, status: "duplicate", entityId: op.entityId });
        continue;
      }

      const table = SYNCABLE[op.entity];

      try {
        const [current] = await db
          .select()
          .from(table)
          .where(eq((table as unknown as { id: never }).id, op.entityId as never))
          .limit(1);

        const currentVersion = (current as { version?: number } | undefined)?.version ?? 0;

        // Conflit : le serveur a une version plus récente que la base du client.
        if (current && op.baseVersion !== undefined && op.baseVersion < currentVersion) {
          await db.insert(syncOperations).values({
            clientOpId: op.clientOpId,
            terminalId: auth.terminalId,
            userId: auth.sub,
            entity: op.entity,
            entityId: op.entityId,
            action: op.action,
            payload: op.payload ?? null,
            status: "conflict",
            conflictDetails: { serverVersion: currentVersion, clientVersion: op.baseVersion },
          });
          results.push({
            clientOpId: op.clientOpId,
            status: "conflict",
            entityId: op.entityId,
            serverVersion: currentVersion,
            message: "Le serveur possède une version plus récente",
          });
          continue;
        }

        const now = new Date();
        const payload = { ...(op.payload ?? {}) } as Record<string, unknown>;
        delete payload["version"];
        delete payload["createdAt"];

        if (op.action === "delete") {
          if ("deletedAt" in (table as Record<string, unknown>)) {
            await db
              .update(table)
              .set({ deletedAt: now, updatedAt: now, version: currentVersion + 1 } as never)
              .where(eq((table as unknown as { id: never }).id, op.entityId as never));
          } else {
            await db.delete(table).where(eq((table as unknown as { id: never }).id, op.entityId as never));
          }
        } else if (current) {
          await db
            .update(table)
            .set({ ...payload, updatedAt: now, version: currentVersion + 1 } as never)
            .where(eq((table as unknown as { id: never }).id, op.entityId as never));
        } else {
          await db
            .insert(table)
            .values({
              ...payload,
              id: op.entityId,
              storeId: (payload["storeId"] as string | undefined) ?? auth.storeId,
              updatedAt: now,
              version: 1,
            } as never);
        }

        await db.insert(syncOperations).values({
          clientOpId: op.clientOpId,
          terminalId: auth.terminalId,
          userId: auth.sub,
          entity: op.entity,
          entityId: op.entityId,
          action: op.action,
          payload: op.payload ?? null,
          status: "applied",
        });

        await writeAuditLog({
          actor: auth,
          action: op.action,
          entity: op.entity,
          entityId: op.entityId,
          newValue: op.payload ?? null,
        });

        const event = WS_EVENT_BY_ENTITY[op.entity];
        if (event) {
          wsHub.broadcast(event, { entity: op.entity, entityId: op.entityId, action: op.action }, auth.storeId);
        }

        results.push({
          clientOpId: op.clientOpId,
          status: "applied",
          entityId: op.entityId,
          serverVersion: currentVersion + 1,
        });
      } catch (error) {
        await db.insert(syncOperations).values({
          clientOpId: op.clientOpId,
          terminalId: auth.terminalId,
          userId: auth.sub,
          entity: op.entity,
          entityId: op.entityId,
          action: op.action,
          payload: op.payload ?? null,
          status: "rejected",
          conflictDetails: { message: (error as Error).message },
        });
        results.push({
          clientOpId: op.clientOpId,
          status: "rejected",
          entityId: op.entityId,
          message: (error as Error).message,
        });
      }
    }

    if (auth.terminalId) {
      await db
        .update(terminals)
        .set({ lastSeenAt: new Date() })
        .where(eq(terminals.id, auth.terminalId));
    }

    return reply.send({ serverTime: new Date().toISOString(), results });
  });

  // -------------------------------------------------------------------------
  // Récupération des modifications serveur depuis un curseur
  // -------------------------------------------------------------------------
  app.get("/api/sync/pull", { preHandler: authenticate }, async (request, reply) => {
    const auth = request.auth!;
    const query = pullSchema.parse(request.query ?? {});
    const since = query.since ? new Date(query.since) : new Date(0);
    if (Number.isNaN(since.getTime())) throw new AppError("Paramètre « since » invalide");

    const requested = (query.entities?.split(",").map((e) => e.trim()).filter(Boolean) ??
      Object.keys(SYNCABLE)) as SyncEntity[];

    const changes: Record<string, unknown[]> = {};

    for (const entity of requested) {
      const table = SYNCABLE[entity];
      if (!table) continue;
      const rows = await db
        .select()
        .from(table)
        .where(gt((table as unknown as { updatedAt: never }).updatedAt, since as never))
        .limit(2000);
      changes[entity] = rows;
    }

    if (auth.terminalId) {
      await db
        .update(terminals)
        .set({ lastSeenAt: new Date() })
        .where(eq(terminals.id, auth.terminalId));
    }

    return reply.send({ serverTime: new Date().toISOString(), since: since.toISOString(), changes });
  });

  // -------------------------------------------------------------------------
  // État de la synchronisation
  // -------------------------------------------------------------------------
  app.get("/api/sync/status", { preHandler: authenticate }, async (request, reply) => {
    const auth = request.auth!;
    const [conflicts] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(syncOperations)
      .where(eq(syncOperations.status, "conflict"));

    return reply.send({
      serverTime: new Date().toISOString(),
      storeId: auth.storeId,
      terminalId: auth.terminalId,
      onlineTerminals: wsHub.onlineTerminals(),
      conflicts: conflicts?.count ?? 0,
    });
  });
}
