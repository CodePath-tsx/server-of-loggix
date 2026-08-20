/**
 * Middleware de contrôle d'accès basé sur les rôles (RBAC) et les permissions fines.
 */
import type { FastifyReply, FastifyRequest } from "fastify";
import { ForbiddenError, UnauthorizedError } from "../lib/errors.js";
import { roleHasPermission, type Permission, type Role } from "../lib/permissions.js";

export function requirePermission(permission: Permission) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (!request.auth) throw new UnauthorizedError();
    if (!roleHasPermission(request.auth.role, permission)) {
      throw new ForbiddenError(`Permission requise : ${permission}`);
    }
  };
}

export function requireRole(...roles: Role[]) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (!request.auth) throw new UnauthorizedError();
    if (!roles.includes(request.auth.role)) {
      throw new ForbiddenError(`Rôle requis parmi : ${roles.join(", ")}`);
    }
  };
}
