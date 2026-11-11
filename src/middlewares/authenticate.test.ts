import { randomUUID } from 'node:crypto'
import express, { type ErrorRequestHandler } from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { AppError } from '../shared/errors.js'
import { signAccessToken, signRefreshToken, tokenExpiration } from '../shared/token.js'
import {
  InMemoryRefreshTokenRepository,
  InMemoryUserRepository,
} from '../tests/fakes/auth-fakes.js'
import { authorize, createAuthenticate, requireVerifiedEmail } from './authenticate.js'

interface TestContext {
  users: InMemoryUserRepository
  sessions: InMemoryRefreshTokenRepository
  userId: string
  sessionId: string
  accessToken: string
}

async function createTestContext(options?: {
  role?: 'admin' | 'teacher' | 'learner'
  verified?: boolean
}): Promise<TestContext> {
  const users = new InMemoryUserRepository()
  const sessions = new InMemoryRefreshTokenRepository()
  const user = await users.create({
    name: 'Awa Ndiaye',
    email: 'awa@example.test',
    passwordHash: 'not-used-by-middleware-tests',
    role: options?.role ?? 'learner',
    emailVerifiedAt: options?.verified === false ? null : new Date(),
  })
  const sessionId = randomUUID()
  const refresh = signRefreshToken(user.id, sessionId, user.authVersion)
  await sessions.create({
    userId: user.id,
    sessionId,
    tokenHash: `hash-${randomUUID()}`,
    jwtId: refresh.jti,
    expiresAt: tokenExpiration(refresh.token),
  })

  return {
    users,
    sessions,
    userId: user.id,
    sessionId,
    accessToken: signAccessToken(user, sessionId),
  }
}

function createTestApp(context: Pick<TestContext, 'users' | 'sessions'>) {
  const app = express()
  const authenticate = createAuthenticate(context.users, context.sessions)

  app.get('/private', authenticate, (req, res) => res.json(req.auth))
  app.get('/admin', authenticate, authorize('admin'), (_req, res) => res.sendStatus(204))
  app.get(
    '/verified',
    authenticate,
    requireVerifiedEmail,
    (_req, res) => res.sendStatus(204),
  )
  app.get('/authorize-only', authorize('admin'), (_req, res) => res.sendStatus(204))
  app.get('/verify-only', requireVerifiedEmail, (_req, res) => res.sendStatus(204))

  const testErrorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof AppError) {
      res.status(error.status).json({ code: error.code, message: error.message })
      return
    }
    res.status(500).json({ code: 'INTERNAL_ERROR' })
  }
  app.use(testErrorHandler)
  return app
}

describe('createAuthenticate', () => {
  it.each([
    ['sans en-tête', undefined],
    ['avec un schéma autre que Bearer', 'Basic abc123'],
    ['avec un jeton Bearer vide', 'Bearer '],
  ])('refuse une requête %s', async (_label, authorization) => {
    const context = await createTestContext()
    const call = request(createTestApp(context)).get('/private')
    if (authorization) call.set('Authorization', authorization)

    const response = await call.expect(401)

    expect(response.body.code).toBe('UNAUTHORIZED')
  })

  it('attache à la requête l’utilisateur courant lorsque la session est active', async () => {
    const context = await createTestContext({ role: 'teacher' })

    const response = await request(createTestApp(context))
      .get('/private')
      .set('Authorization', `Bearer ${context.accessToken}`)
      .expect(200)

    expect(response.body).toMatchObject({
      userId: context.userId,
      email: 'awa@example.test',
      role: 'teacher',
      sessionId: context.sessionId,
    })
    expect(response.body.emailVerifiedAt).toBeTypeOf('string')
  })

  it('refuse immédiatement un access token dont la session a été révoquée', async () => {
    const context = await createTestContext()
    await context.sessions.revokeSession(context.userId, context.sessionId, 'test')

    const response = await request(createTestApp(context))
      .get('/private')
      .set('Authorization', `Bearer ${context.accessToken}`)
      .expect(401)

    expect(response.body.code).toBe('SESSION_REVOKED')
  })

  it('refuse un access token créé avant un changement de authVersion', async () => {
    const context = await createTestContext()
    await context.users.bumpAuthVersion(context.userId)

    const response = await request(createTestApp(context))
      .get('/private')
      .set('Authorization', `Bearer ${context.accessToken}`)
      .expect(401)

    expect(response.body.code).toBe('SESSION_REVOKED')
  })

  it('refuse un compte désactivé même si son access token est encore signé', async () => {
    const context = await createTestContext()
    const user = await context.users.findById(context.userId)
    user?.set({ isActive: false })

    const response = await request(createTestApp(context))
      .get('/private')
      .set('Authorization', `Bearer ${context.accessToken}`)
      .expect(401)

    expect(response.body.code).toBe('ACCOUNT_DISABLED')
  })
})

describe('authorize', () => {
  it('autorise le rôle demandé', async () => {
    const context = await createTestContext({ role: 'admin' })

    await request(createTestApp(context))
      .get('/admin')
      .set('Authorization', `Bearer ${context.accessToken}`)
      .expect(204)
  })

  it('refuse un rôle insuffisant', async () => {
    const context = await createTestContext({ role: 'learner' })

    const response = await request(createTestApp(context))
      .get('/admin')
      .set('Authorization', `Bearer ${context.accessToken}`)
      .expect(403)

    expect(response.body.code).toBe('FORBIDDEN')
  })

  it('refuse une requête qui n’a pas été authentifiée', async () => {
    const context = await createTestContext()
    const response = await request(createTestApp(context)).get('/authorize-only').expect(401)
    expect(response.body.code).toBe('UNAUTHORIZED')
  })
})

describe('requireVerifiedEmail', () => {
  it('laisse passer une adresse vérifiée', async () => {
    const context = await createTestContext({ verified: true })

    await request(createTestApp(context))
      .get('/verified')
      .set('Authorization', `Bearer ${context.accessToken}`)
      .expect(204)
  })

  it('refuse une adresse non vérifiée', async () => {
    const context = await createTestContext({ verified: false })

    const response = await request(createTestApp(context))
      .get('/verified')
      .set('Authorization', `Bearer ${context.accessToken}`)
      .expect(403)

    expect(response.body.code).toBe('EMAIL_NOT_VERIFIED')
  })

  it('refuse une requête qui n’a pas été authentifiée', async () => {
    const context = await createTestContext()
    const response = await request(createTestApp(context)).get('/verify-only').expect(401)
    expect(response.body.code).toBe('UNAUTHORIZED')
  })
})
