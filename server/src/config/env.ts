import "dotenv/config";
import { z } from "zod";

/**
 * Schéma de validation des variables d'environnement.
 * Toute variable manquante ou invalide fait échouer le démarrage du serveur.
 */
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  SERVER_LAN_IP: z.string().default("192.168.1.10"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL est requis"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET doit contenir au moins 16 caractères"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET doit contenir au moins 16 caractères"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_WINDOW: z.string().default("1 minute"),
  OWNER_DEFAULT_PASSWORD: z.string().min(8).default("ChangeMoi123!"),
  BACKUP_DIR: z.string().default("./backups"),
  BACKUP_RETENTION_DAYS: z.coerce.number().int().positive().default(14),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Variables d'environnement invalides :", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const corsOrigins = env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean);
