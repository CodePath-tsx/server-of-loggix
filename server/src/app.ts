/**
 * Construction de l'application Fastify : sécurité, CORS, limitation de débit,
 * gestion centralisée des erreurs, WebSocket et enregistrement des routes.
 */
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import { env, corsOrigins } from "./config/env.js";
import { AppError } from "./lib/errors.js";
import { pool } from "./db/index.js";
import { registerWebSocket } from "./plugins/websocket.js";

import { authRoutes } from "./routes/auth.js";
import { productsRoutes } from "./routes/products.js";
import { categoriesRoutes } from "./routes/categories.js";
import { inventoryRoutes } from "./routes/inventory.js";
import { salesRoutes } from "./routes/sales.js";
import { syncRoutes } from "./routes/sync.js";
import { terminalRoutes } from "./routes/terminals.js";
import { customerRoutes } from "./routes/customers.js";
import { reportRoutes } from "./routes/reports.js";
import { licenseRoutes } from "./routes/licenses.js";
import { backupRoutes } from "./routes/backups.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
    },
    trustProxy: true,
    bodyLimit: 10 * 1024 * 1024, // 10 Mo (lots de synchronisation)
  });

  await app.register(helmet, { contentSecurityPolicy: false });

  await app.register(cors, {
    origin: (origin, cb) => {
      // Requêtes locales (Electron, outils CLI) sans en-tête Origin : autorisées
      if (!origin) return cb(null, true);
      if (corsOrigins.includes("*") || corsOrigins.includes(origin)) return cb(null, true);
      // Autorise tout le réseau local privé (192.168.x.x / 10.x.x.x)
      if (/^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) {
        return cb(null, true);
      }
      cb(new Error("Origine non autorisée par la politique CORS"), false);
    },
    credentials: true,
  });

  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    errorResponseBuilder: () => ({
      error: "TROP_DE_REQUETES",
      message: "Trop de requêtes envoyées. Veuillez patienter quelques instants.",
    }),
  });

  await registerWebSocket(app);

  // ------------------------------------------------------------------
  // Santé du serveur
  // ------------------------------------------------------------------
  app.get("/api/health", async (_request, reply) => {
    let database = "indisponible";
    try {
      await pool.query("SELECT 1");
      database = "connectee";
    } catch {
      database = "erreur";
    }
    return reply.send({
      status: "ok",
      version: "1.0.0",
      database,
      serverTime: new Date().toISOString(),
      lanIp: env.SERVER_LAN_IP,
      port: env.PORT,
    });
  });

  // ------------------------------------------------------------------
  // Routes métier
  // ------------------------------------------------------------------
  await app.register(authRoutes);
  await app.register(productsRoutes);
  await app.register(categoriesRoutes);
  await app.register(inventoryRoutes);
  await app.register(salesRoutes);
  await app.register(customerRoutes);
  await app.register(reportRoutes);
  await app.register(terminalRoutes);
  await app.register(licenseRoutes);
  await app.register(backupRoutes);
  await app.register(syncRoutes);

  // ------------------------------------------------------------------
  // Gestion centralisée des erreurs (messages en français)
  // ------------------------------------------------------------------
  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: "INTROUVABLE",
      message: `Route introuvable : ${request.method} ${request.url}`,
    });
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(422).send({
        error: "VALIDATION",
        message: "Données invalides",
        details: error.flatten().fieldErrors,
      });
    }
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: error.code,
        message: error.message,
        details: error.details,
      });
    }
    request.log.error(error);
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    return reply.code(status).send({
      error: status === 500 ? "ERREUR_SERVEUR" : "ERREUR",
      message: status === 500 ? "Erreur interne du serveur" : error.message,
    });
  });

  return app;
}
