/**
 * Point d'entrée du serveur central LogixStore.
 * Démarre Fastify sur toutes les interfaces réseau (LAN) et planifie les sauvegardes.
 */
import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/index.js";
import { createBackup, purgeOldBackups } from "./lib/backup.js";

const BACKUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // toutes les 6 heures

async function main(): Promise<void> {
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }

  app.log.info(`✅ Serveur central prêt sur http://${env.SERVER_LAN_IP}:${env.PORT}`);

  // Sauvegardes automatiques périodiques
  const timer = setInterval(() => {
    createBackup("auto")
      .then(async (file) => {
        app.log.info(`💾 Sauvegarde automatique créée : ${file.name}`);
        const removed = await purgeOldBackups();
        if (removed > 0) app.log.info(`🧹 ${removed} ancienne(s) sauvegarde(s) supprimée(s)`);
      })
      .catch((error) => app.log.error(`Échec de la sauvegarde automatique : ${(error as Error).message}`));
  }, BACKUP_INTERVAL_MS);
  timer.unref?.();

  const shutdown = async (signal: string) => {
    app.log.info(`Arrêt du serveur (${signal})…`);
    clearInterval(timer);
    await app.close();
    await pool.end();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void main();
