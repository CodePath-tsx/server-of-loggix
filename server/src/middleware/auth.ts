/**
 * Middleware d'authentification : vérifie le jeton JWT d'accès et attache
 * les informations de l'utilisateur courant à la requête (request.auth).
 */
import type { FastifyReply, FastifyRequest } from "fastify";
import { verifyAccessToken, type AccessTokenPayload } from "../lib/jwt.js";
import { UnauthorizedError } from "../lib/errors.js";

declare module "fastify" {
  interface FastifyRequest {
    auth?: AccessTokenPayload;
  }
}

export async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw new UnauthorizedError("Jeton d'accès manquant");
  }
  const token = header.slice("Bearer ".length);
  try {
    request.auth = verifyAccessToken(token);
  } catch {
    throw new UnauthorizedError("Jeton d'accès invalide ou expiré");
  }
}
