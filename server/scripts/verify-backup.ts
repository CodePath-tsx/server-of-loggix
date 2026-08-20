/**
 * Vérification de l'intégrité des sauvegardes : npm run backup:verify [-- fichier.dump]
 */
import { listBackups, verifyBackup } from "../src/lib/backup.js";

async function main() {
  const target = process.argv[2];
  const files = target ? [{ name: target }] : await listBackups();

  if (files.length === 0) {
    console.log("Aucune sauvegarde trouvée.");
    return;
  }

  let invalid = 0;
  for (const file of files) {
    const result = await verifyBackup(file.name);
    console.log(`${result.valid ? "✅" : "❌"} ${file.name}`);
    if (!result.valid) invalid += 1;
  }

  if (invalid > 0) {
    console.error(`${invalid} sauvegarde(s) corrompue(s).`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ Échec de la vérification :", (error as Error).message);
  process.exit(1);
});
