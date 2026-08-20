/**
 * Sauvegarde manuelle : npm run backup [-- étiquette]
 */
import { createBackup, purgeOldBackups } from "../src/lib/backup.js";

const label = process.argv[2] ?? "manuelle";

createBackup(label)
  .then(async (file) => {
    console.log(`✅ Sauvegarde créée : ${file.name} (${(file.sizeBytes / 1024 / 1024).toFixed(2)} Mo)`);
    const removed = await purgeOldBackups();
    if (removed) console.log(`🧹 ${removed} ancienne(s) sauvegarde(s) supprimée(s)`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Échec de la sauvegarde :", (error as Error).message);
    process.exit(1);
  });
