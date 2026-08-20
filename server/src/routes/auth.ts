/**
 * Routes d'authentification : connexion, rafraîchissement, déconnexion, profil courant,
 * et enregistrement des terminaux (postes de caisse / afficheurs de prix).
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import crypto from "node:crypto";
import { db } from "../db/index.js";
import { users, roles, sessions, terminals } from "../db/schema.js";
import { verifyPassword, hashPassword } from "../lib/password.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/jwt.js";
import { UnauthorizedError, NotFoundError, AppError } from "../lib/errors.js";
import { authenticate } from "../middleware/auth.js";
import { env } from "../config/env.js";
import type { Role } from "../lib/permissions.js";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  terminalId: z.string().optional(),
});

const registerTerminalSchema = z.object({
  storeId: z.string().min(1),
  branchId: z.string().optional(),
  code: z.string().min(1),
  type: z.enum(["pos", "display"]).default("pos"),
  label: z.string().optional(),
  ipAddress: z.string().optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const REFRESH_EXPIRES_MS = 1000 * 60 * 60 * 24 * 30; // 30 jours par défaut

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Enregistrement / mise à jour d'un terminal (poste de caisse ou afficheur de prix)
  app.post("/api/auth/register-terminal", async (request, reply) => {
    const body = registerTerminalSchema.parse(request.body);

    const existing = await db.select().from(terminals).where(eq(terminals.code, body.code)).limit(1);

    let terminal;
    if (existing[0]) {
      [terminal] = await db
        .update(terminals)
        .set({
          storeId: body.storeId,
          branchId: body.branchId ?? existing[0].branchId,
          type: body.type,
          label: body.label ?? existing[0].label,
          ipAddress: body.ipAddress ?? existing[0].ipAddress,
          isActive: true,
          version: existing[0].version + 1,
          updatedAt: new Date(),
        })
        .where(eq(terminals.id, existing[0].id))
        .returning();
    } else {
      [terminal] = await db
        .insert(terminals)
        .values({
          storeId: body.storeId,
          branchId: body.branchId,
          code: body.code,
          type: body.type,
          label: body.label,
          ipAddress: body.ipAddress,
        })
        .returning();
    }

    return reply.code(201).send({ terminalId: terminal.id, code: terminal.code, type: terminal.type });
  });

  // Connexion
  app.post("/api/auth/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.username, body.username), eq(users.isActive, true)))
      .limit(1);

    if (!user) throw new UnauthorizedError("Identifiants invalides");

    const passwordOk = await verifyPassword(body.password, user.passwordHash);
    if (!passwordOk) throw new UnauthorizedError("Identifiants invalides");

    const [role] = await db.select().from(roles).where(eq(roles.id, user.roleId)).limit(1);
    if (!role) throw new AppError("Rôle utilisateur introuvable", 500, "ROLE_INTROUVABLE");

    if (body.terminalId) {
      const [terminal] = await db.select().from(terminals).where(eq(terminals.id, body.terminalId)).limit(1);
      if (!terminal) throw new NotFoundError("Terminal introuvable");
    }

    const accessToken = signAccessToken({
      sub: user.id,
      storeId: user.storeId,
      branchId: user.branchId,
      role: role.name as Role,
      terminalId: body.terminalId ?? null,
    });

    const refreshTokenRaw = crypto.randomBytes(32).toString("hex");
    const [session] = await db
      .insert(sessions)
      .values({
        userId: user.id,
        terminalId: body.terminalId,
        refreshTokenHash: hashToken(refreshTokenRaw),
        userAgent: request.headers["user-agent"] ?? null,
        ipAddress: request.ip,
        expiresAt: new Date(Date.now() + REFRESH_EXPIRES_MS),
      })
      .returning();

    const refreshToken = signRefreshToken({ sub: user.id, sessionId: session.id });

    await db
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, user.id));

    return reply.send({
      accessToken,
      refreshToken,
      mustChangePassword: user.mustChangePassword,
      user: {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        role: role.name,
        storeId: user.storeId,
        branchId: user.branchId,
      },
    });
  });

  // Rafraîchissement du jeton d'accès
  app.post("/api/auth/refresh", async (request, reply) => {
    const body = refreshSchema.parse(request.body);

    let decoded;
    try {
      decoded = verifyRefreshToken(body.refreshToken);
    } catch {
      throw new UnauthorizedError("Jeton de rafraîchissement invalide");
    }

    const [session] = await db.select().from(sessions).where(eq(sessions.id, decoded.sessionId)).limit(1);
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedError("Session expirée, veuillez vous reconnecter");
    }

    const [user] = await db.select().from(users).where(eq(users.id, decoded.sub)).limit(1);
    if (!user || !user.isActive) throw new UnauthorizedError("Utilisateur introuvable ou désactivé");

    const [role] = await db.select().from(roles).where(eq(roles.id, user.roleId)).limit(1);
    if (!role) throw new AppError("Rôle utilisateur introuvable", 500, "ROLE_INTROUVABLE");

    const accessToken = signAccessToken({
      sub: user.id,
      storeId: user.storeId,
      branchId: user.branchId,
      role: role.name as Role,
      terminalId: session.terminalId,
    });

    return reply.send({ accessToken });
  });

  // Déconnexion (révocation de la session)
  app.post("/api/auth/logout", { preHandler: authenticate }, async (request, reply) => {
    const body = z.object({ refreshToken: z.string().optional() }).parse(request.body ?? {});
    if (body.refreshToken) {
      try {
        const decoded = verifyRefreshToken(body.refreshToken);
        await db
          .update(sessions)
          .set({ revokedAt: new Date() })
          .where(eq(sessions.id, decoded.sessionId));
      } catch {
        // jeton déjà invalide : rien à faire
      }
    }
    return reply.send({ success: true });
  });

  // Profil de l'utilisateur courant
  app.get("/api/auth/me", { preHandler: authenticate }, async (request, reply) => {
    const auth = request.auth!;
    const [user] = await db.select().from(users).where(eq(users.id, auth.sub)).limit(1);
    if (!user) throw new NotFoundError("Utilisateur introuvable");

    return reply.send({
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      role: auth.role,
      storeId: user.storeId,
      branchId: user.branchId,
      mustChangePassword: user.mustChangePassword,
    });
  });

  // Changement de mot de passe (notamment mot de passe initial imposé)
  app.post(
    "/api/auth/change-password",
    { preHandler: authenticate },
    async (request, reply) => {
      const body = z
        .object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) })
        .parse(request.body);

      const [user] = await db.select().from(users).where(eq(users.id, request.auth!.sub)).limit(1);
      if (!user) throw new NotFoundError("Utilisateur introuvable");

      const ok = await verifyPassword(body.currentPassword, user.passwordHash);
      if (!ok) throw new UnauthorizedError("Mot de passe actuel incorrect");

      const newHash = await hashPassword(body.newPassword);
      await db
        .update(users)
        .set({ passwordHash: newHash, mustChangePassword: false, updatedAt: new Date() })
        .where(eq(users.id, user.id));

      return reply.send({ success: true });
    }
  );
}
