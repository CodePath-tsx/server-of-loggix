/**
 * Écriture centralisée des journaux d'audit pour les actions sensibles
 * (produits, prix, ventes, retours, ajustements de stock).
 */
import { db } from "../db/index.js";
import { auditLogs } from "../db/schema.js";
import type { AccessTokenPayload } from "./jwt.js";

interface AuditParams {
  actor: AccessTokenPayload | null;
  action: "create" | "update" | "delete";
  entity: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
}

export async function writeAuditLog(params: AuditParams): Promise<void> {
  await db.insert(auditLogs).values({
    storeId: params.actor?.storeId ?? null,
    userId: params.actor?.sub ?? null,
    terminalId: params.actor?.terminalId ?? null,
    action: params.action,
    entity: params.entity,
    entityId: params.entityId,
    oldValue: params.oldValue ?? null,
    newValue: params.newValue ?? null,
  });
}
