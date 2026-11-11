import { createHash } from 'node:crypto'
import type { Request } from 'express'
import { ipKeyGenerator, rateLimit } from 'express-rate-limit'

type RateLimitOptions = Parameters<typeof rateLimit>[0]

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function networkKey(request: Request): string {
  const address = request.ip ?? request.socket.remoteAddress ?? 'unknown'
  return ipKeyGenerator(address)
}

/**
 * Conserve une limite par identité lorsque plusieurs apprenants partagent la
 * même adresse publique (NAT d'une école), sans stocker l'e-mail ou le jeton
 * en clair dans le store du limiteur.
 */
export function identityRateLimitKey(request: Request): string {
  const email = typeof request.body?.email === 'string'
    ? request.body.email.trim().toLowerCase()
    : ''
  const token = typeof request.body?.token === 'string' ? request.body.token : ''
  const userId = request.auth?.userId ?? ''
  const identity = userId || email || token

  return identity
    ? `${networkKey(request)}:${digest(identity)}`
    : networkKey(request)
}

/** La limite générale protège le réseau ; les routes auth ajoutent une clé par identité. */
export function generalRateLimitKey(request: Request): string {
  return networkKey(request)
}

export function createRateLimiter(options: RateLimitOptions) {
  return rateLimit({
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ...options,
    handler: (request, response) => {
      response.status(429).json({
        success: false,
        error: {
          code: 'TOO_MANY_ATTEMPTS',
          message: 'Trop de tentatives. Réessayez plus tard.',
        },
        request_id: request.requestId,
      })
    },
  })
}
