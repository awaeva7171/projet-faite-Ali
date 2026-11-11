export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = new.target.name
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, 'BAD_REQUEST', message, details)
  }
}

export class ValidationError extends AppError {
  constructor(details?: unknown) {
    super(400, 'VALIDATION_ERROR', 'Les données envoyées sont invalides.', details)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentification requise.', code = 'UNAUTHORIZED') {
    super(401, code, message)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Vous ne disposez pas de cette autorisation.', code = 'FORBIDDEN') {
    super(403, code, message)
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Ressource introuvable.') {
    super(404, 'NOT_FOUND', message)
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown, code = 'CONFLICT') {
    super(409, code, message, details)
  }
}

export class GoneError extends AppError {
  constructor(message = 'Ce lien a expiré ou a déjà été utilisé.', code = 'TOKEN_EXPIRED') {
    super(410, code, message)
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Trop de tentatives. Réessayez plus tard.', code = 'TOO_MANY_ATTEMPTS') {
    super(429, code, message)
  }
}
