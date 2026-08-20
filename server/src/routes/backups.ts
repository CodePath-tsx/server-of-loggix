/**
 * Routes de sauvegarde : liste, création, vérification, restauration et purge.
 * Réservées aux rôles disposant de la permission « settings.manage ».
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { AppError } from "../lib/errors.js";
import { writeAuditLog } from "../lib/audit.js";
import {
  createBackup,
  listBackups,
  purgeOldBackups,
  restoreBackup,
  verifyBackup,
} from "../lib/backup.js";

const nameSchema = z.object({ fileName: z.string().min(1) });

export async function backupRoutes(app: FastifyInstance): Promise<void> {
  const guard = { preHandler: [authenticate, requirePermission("settings.manage")] };

  app.get("/api/backups", guard, async (_request, reply) => {
    const files = await listBackups();
    return reply.send({ backups: files.map(({ path: _p, ...rest }) => rest) });
  });

  app.post("/api/backups", guard, async (request, reply) => {
    const body = z.object({ label: z.string().max(40).optional() }).parse(request.body ?? {});
    try {
      const file = await createBackup(body.label ?? "manuelle");
      await purgeOldBackups();
      await writeAuditLog({
        actor: request.auth ?? null,
        action: "create",
        entity: "backup",
        entityId: file.name,
        newValue: { sizeBytes: file.sizeBytes },
      });
      return reply.code(201).send({ backup: { name: file.name, sizeBytes: file.sizeBytes, createdAt: file.createdAt } });
    } catch (error) {
      throw new AppError(
        `Échec de la sauvegarde : ${(error as Error).message}`,
        500,
        "SAUVEGARDE_ECHOUEE"
      );
    }
  });

  app.post("/api/backups/verify", guard, async (request, reply) => {
    const { fileName } = nameSchema.parse(request.body);
    const result = await verifyBackup(fileName);
    return reply.send(result);
  });

  app.post("/api/backups/restore", guard, async (request, reply) => {
    const { fileName } = nameSchema.parse(request.body);
    const check = await verifyBackup(fileName);
    if (!check.valid) {
      throw new AppError(
        "Sauvegarde corrompue ou empreinte manquante : restauration annulée",
        409,
        "SAUVEGARDE_INVALIDE"
      );
    }
    try {
      await restoreBackup(fileName);
    } catch (error) {
      throw new AppError(
        `Échec de la restauration : ${(error as Error).message}`,
        500,
        "RESTAURATION_ECHOUEE"
      );
    }
    await writeAuditLog({
      actor: request.auth ?? null,
      action: "update",
      entity: "backup",
      entityId: fileName,
      newValue: { restored: true },
    });
    return reply.send({ message: `Sauvegarde « ${fileName} » restaurée avec succès` });
  });

  app.post("/api/backups/purge", guard, async (_request, reply) => {
    const removed = await purgeOldBackups();
    return reply.send({ removed, message: `${removed} sauvegarde(s) ancienne(s) supprimée(s)` });
  });
}
