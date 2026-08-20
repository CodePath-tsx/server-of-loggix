/**
 * Erreurs métier typées, converties en réponses HTTP cohérentes.
 */
export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(message: string, statusCode = 400, code = "ERREUR", details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Non authentifié") {
    super(message, 401, "NON_AUTHENTIFIE");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Accès refusé") {
    super(message, 403, "ACCES_REFUSE");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Ressource introuvable") {
    super(message, 404, "INTROUVABLE");
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflit de version", details?: unknown) {
    super(message, 409, "CONFLIT", details);
  }
}
