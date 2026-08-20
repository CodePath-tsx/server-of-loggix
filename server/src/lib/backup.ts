/**
 * Sauvegarde et restauration de la base PostgreSQL via pg_dump / psql.
 * Les fichiers sont stockés dans BACKUP_DIR et purgés après BACKUP_RETENTION_DAYS jours.
 */
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { env } from "../config/env.js";

export interface BackupFile {
  name: string;
  path: string;
  sizeBytes: number;
  createdAt: string;
}

export function backupDir(): string {
  return path.resolve(env.BACKUP_DIR);
}

async function ensureDir(): Promise<string> {
  const dir = backupDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, PGCONNECT_TIMEOUT: "10" },
      stdio: ["ignore", "inherit", "pipe"],
    });
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) =>
      reject(new Error(`Impossible d'exécuter « ${command} » : ${error.message}`))
    );
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`« ${command} » a échoué (code ${code}) : ${stderr.trim()}`));
    });
  });
}

/** Crée une sauvegarde complète et renvoie le fichier produit. */
export async function createBackup(label = "auto"): Promise<BackupFile> {
  const dir = await ensureDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const name = `logixstore-${label}-${stamp}.dump`;
  const filePath = path.join(dir, name);

  await run("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", "--file", filePath, env.DATABASE_URL]);

  const stat = await fs.stat(filePath);
  await fs.writeFile(`${filePath}.sha256`, await checksum(filePath), "utf8");

  return {
    name,
    path: filePath,
    sizeBytes: stat.size,
    createdAt: stat.mtime.toISOString(),
  };
}

/** Restaure une sauvegarde existante (écrase les données actuelles). */
export async function restoreBackup(fileName: string): Promise<void> {
  const dir = backupDir();
  const filePath = path.join(dir, path.basename(fileName));
  await fs.access(filePath);
  await run("pg_restore", ["--clean", "--if-exists", "--no-owner", "--dbname", env.DATABASE_URL, filePath]);
}

export async function listBackups(): Promise<BackupFile[]> {
  const dir = await ensureDir();
  const entries = await fs.readdir(dir);
  const files: BackupFile[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".dump")) continue;
    const full = path.join(dir, entry);
    const stat = await fs.stat(full);
    files.push({ name: entry, path: full, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() });
  }
  return files.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function checksum(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/** Vérifie l'intégrité d'une sauvegarde à partir de son empreinte SHA-256. */
export async function verifyBackup(fileName: string): Promise<{ valid: boolean; expected?: string; actual: string }> {
  const dir = backupDir();
  const filePath = path.join(dir, path.basename(fileName));
  const actual = await checksum(filePath);
  try {
    const expected = (await fs.readFile(`${filePath}.sha256`, "utf8")).trim();
    return { valid: expected === actual, expected, actual };
  } catch {
    return { valid: false, actual };
  }
}

/** Supprime les sauvegardes plus anciennes que la durée de rétention. */
export async function purgeOldBackups(): Promise<number> {
  const files = await listBackups();
  const limit = Date.now() - env.BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const file of files) {
    if (new Date(file.createdAt).getTime() < limit) {
      await fs.rm(file.path, { force: true });
      await fs.rm(`${file.path}.sha256`, { force: true });
      removed += 1;
    }
  }
  return removed;
}
