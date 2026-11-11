import type { RequestHandler } from 'express'
import { NotFoundError } from '../shared/errors.js'

export const notFound: RequestHandler = (request, _response, next) => {
  next(new NotFoundError(`Route ${request.method} ${request.originalUrl} introuvable.`))
}
