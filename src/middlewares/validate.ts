import type { RequestHandler } from 'express'
import type { ZodType } from 'zod'
import { ValidationError } from '../shared/errors.js'

function validationMiddleware(target: 'body' | 'params' | 'query', schema: ZodType): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request[target])
    if (!result.success) {
      return next(new ValidationError(result.error.flatten()))
    }
    request.validated = { ...request.validated, [target]: result.data }
    next()
  }
}

export const validateBody = (schema: ZodType): RequestHandler => validationMiddleware('body', schema)
export const validateParams = (schema: ZodType): RequestHandler => validationMiddleware('params', schema)
export const validateQuery = (schema: ZodType): RequestHandler => validationMiddleware('query', schema)
