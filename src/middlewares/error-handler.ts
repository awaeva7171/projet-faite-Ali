import type { ErrorRequestHandler } from 'express'
import { UniqueConstraintError } from 'sequelize'
import { ZodError } from 'zod'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { AppError } from '../shared/errors.js'

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  const known = error instanceof AppError
  const validation = error instanceof ZodError
  const duplicate = error instanceof UniqueConstraintError
  const invalidJson =
    error instanceof SyntaxError &&
    typeof error === 'object' &&
    error !== null &&
    'body' in error
  const status = known ? error.status : validation || invalidJson ? 400 : duplicate ? 409 : 500
  const code = known
    ? error.code
    : validation || invalidJson
      ? 'VALIDATION_ERROR'
      : duplicate
        ? 'CONFLICT'
        : 'INTERNAL_ERROR'
  const message = known
    ? error.message
    : validation || invalidJson
      ? 'Les données envoyées sont invalides.'
      : duplicate
        ? 'Une donnée unique existe déjà.'
      : 'Une erreur interne est survenue.'
  const details = known ? error.details : validation ? error.flatten() : undefined

  logger.error({ error, requestId: request.requestId }, 'HTTP request failed')

  response.status(status).json({
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
      ...(env.NODE_ENV === 'development' && !known && !validation ? { stack: error.stack } : {}),
    },
    request_id: request.requestId,
  })
}
