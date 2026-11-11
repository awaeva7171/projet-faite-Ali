import { createHash, randomBytes, randomUUID } from 'node:crypto'
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken'
import { env } from '../config/env.js'
import type { UserRole } from '../modules/users/user.model.js'

export interface AccessTokenPayload extends JwtPayload {
  sub: string
  email: string
  role: UserRole
  type: 'access'
  ver: number
  sid: string
}

export interface RefreshTokenPayload extends JwtPayload {
  sub: string
  jti: string
  type: 'refresh'
  sid: string
  ver: number
}

export function signAccessToken(
  user: { id: string; email: string; role: UserRole; authVersion: number },
  sessionId: string,
): string {
  return jwt.sign(
    {
      email: user.email,
      role: user.role,
      type: 'access',
      ver: user.authVersion,
      sid: sessionId,
    },
    env.JWT_ACCESS_SECRET,
    {
      subject: user.id,
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'],
    },
  )
}

export function signRefreshToken(
  userId: string,
  sessionId: string,
  authVersion: number,
): { token: string; jti: string } {
  const jti = randomUUID()
  const token = jwt.sign(
    { type: 'refresh', sid: sessionId, ver: authVersion },
    env.JWT_REFRESH_SECRET,
    {
      subject: userId,
      jwtid: jti,
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'],
    },
  )
  return { token, jti }
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload
  if (
    payload.type !== 'access' ||
    !payload.sub ||
    !payload.sid ||
    !Number.isInteger(payload.ver)
  ) {
    throw new Error('Type de jeton invalide.')
  }
  return payload
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload
  if (
    payload.type !== 'refresh' ||
    !payload.sub ||
    !payload.jti ||
    !payload.sid ||
    !Number.isInteger(payload.ver)
  ) {
    throw new Error('Type de jeton invalide.')
  }
  return payload
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function hashText(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url')
}

export function tokenExpiration(token: string): Date {
  const decoded = jwt.decode(token) as JwtPayload | null
  if (!decoded?.exp) throw new Error('Le jeton ne contient pas de date d’expiration.')
  return new Date(decoded.exp * 1000)
}

export function tokenLifetimeSeconds(token: string): number {
  const decoded = jwt.decode(token) as JwtPayload | null
  if (!decoded?.exp || !decoded.iat) return 0
  return decoded.exp - decoded.iat
}
