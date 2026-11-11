import type { RequestHandler } from 'express'
import { RefreshTokenRepository } from '../modules/auth/refresh-token.repository.js'
import { UserRepository } from '../modules/users/user.repository.js'
import type { UserRole } from '../modules/users/user.model.js'
import { ForbiddenError, UnauthorizedError } from '../shared/errors.js'
import { verifyAccessToken } from '../shared/token.js'
import type { IRefreshTokenRepository } from '../modules/auth/refresh-token.repository.js'
import type { IUserRepository } from '../modules/users/user.repository.js'

export function createAuthenticate(
  users: IUserRepository = new UserRepository(),
  sessions: IRefreshTokenRepository = new RefreshTokenRepository(),
): RequestHandler {
  return (request, _response, next) => {
    const authorization = request.header('authorization')
    if (!authorization?.startsWith('Bearer ')) return next(new UnauthorizedError())

    let payload
    try {
      payload = verifyAccessToken(authorization.slice(7))
    } catch {
      return next(new UnauthorizedError('Jeton invalide ou expiré.'))
    }

    void Promise.all([
      users.findById(payload.sub),
      sessions.hasActiveSession(payload.sub, payload.sid),
    ])
      .then(([user, activeSession]) => {
        if (!user?.isActive) {
          return next(new UnauthorizedError('Compte introuvable ou désactivé.', 'ACCOUNT_DISABLED'))
        }
        if (user.authVersion !== payload.ver || !activeSession) {
          return next(new UnauthorizedError('Cette session a été révoquée.', 'SESSION_REVOKED'))
        }
        request.auth = {
          userId: user.id,
          email: user.email,
          role: user.role,
          sessionId: payload.sid,
          emailVerifiedAt: user.emailVerifiedAt,
        }
        next()
      })
      .catch(next)
  }
}

export const authenticate = createAuthenticate()

export function authorize(...roles: UserRole[]): RequestHandler {
  return (request, _response, next) => {
    if (!request.auth) return next(new UnauthorizedError())
    if (!roles.includes(request.auth.role)) return next(new ForbiddenError())
    next()
  }
}

export const requireVerifiedEmail: RequestHandler = (request, _response, next) => {
  if (!request.auth) return next(new UnauthorizedError())
  if (!request.auth.emailVerifiedAt) {
    return next(
      new ForbiddenError(
        'Vérifiez votre adresse email avant de continuer.',
        'EMAIL_NOT_VERIFIED',
      ),
    )
  }
  next()
}
