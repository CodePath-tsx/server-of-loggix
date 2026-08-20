/**
 * Restauration d'une sauvegarde : npm run restore -- nom-du-fichier.dump
 * ⚠️ Écrase les données actuelles de la base.
 */
import { listBackups, restoreBackup, verifyBackup } from "../src/lib/backup.js";

const fileName = process.argv[2];

async function main() {
  if (!fileName) {
    const files = await listBackups();
    console.error("❌ Indiquez le nom du fichier à restaurer. Sauvegardes disponibles :");
    for (const file of files) console.error(`   - ${file.name} (${file.createdAt})`);
    process.exit(1);
  }

  const check = await verifyBackup(fileName);
  if (!check.valid) {
    console.error("❌ Empreinte SHA-256 invalide ou absente : restauration annulée.");
    process.exit(1);
  }

  await restoreBackup(fileName);
  console.log(`✅ Base restaurée depuis « ${fileName} ».`);
}

main().catch((error) => {
  console.error("❌ Échec de la restauration :", (error as Error).message);
  process.exit(1);
});
