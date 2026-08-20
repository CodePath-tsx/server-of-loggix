/**
 * Domain error hierarchy. All app-thrown errors must extend AppError so the
 * global IPC/error handler can classify them and return a safe payload to the
 * renderer without leaking internals.
 */
export class AppError extends Error {
  readonly code: string;
  readonly httpLike: number;
  readonly cause?: unknown;
  constructor(code: string, message: string, httpLike = 500, cause?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.httpLike = httpLike;
    this.cause = cause;
  }
  toJSON() {
    return { code: this.code, message: this.message, name: this.name };
  }
}

export class ValidationError extends AppError {
  readonly issues: unknown;
  constructor(message: string, issues?: unknown) {
    super("VALIDATION", message, 400);
    this.issues = issues;
  }
}
export class AuthError extends AppError {
  constructor(message = "Non autorisé") { super("AUTH", message, 401); }
}
export class PermissionError extends AppError {
  constructor(perm: string) { super("PERMISSION", `Permission requise : ${perm}`, 403); }
}
export class NotFoundError extends AppError {
  constructor(entity: string, id?: string) {
    super("NOT_FOUND", `${entity}${id ? ` (${id})` : ""} non trouvé`, 404);
  }
}
export class LicenseError extends AppError {
  constructor(message: string) { super("LICENSE", message, 402); }
}
export class DatabaseError extends AppError {
  constructor(message: string, cause?: unknown) { super("DB", message, 500, cause); }
}
