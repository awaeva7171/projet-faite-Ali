import { beforeEach, describe, expect, it } from 'vitest'
import { verifyPassword } from '../../shared/password.js'
import { hashText } from '../../shared/token.js'
import {
  FakeMailService,
  InMemoryAuditRepository,
  InMemoryOneTimeTokenRepository,
  InMemoryRefreshTokenRepository,
  InMemoryUserRepository,
} from '../../tests/fakes/auth-fakes.js'
import { registerSchema } from './auth.schema.js'
import { AuthService } from './auth.service.js'

const context = { ipAddress: '127.0.0.1', userAgent: 'Vitest' }

describe('AuthService', () => {
  let users: InMemoryUserRepository
  let sessions: InMemoryRefreshTokenRepository
  let oneTimeTokens: InMemoryOneTimeTokenRepository
  let audit: InMemoryAuditRepository
  let mail: FakeMailService
  let service: AuthService

  beforeEach(() => {
    users = new InMemoryUserRepository()
    sessions = new InMemoryRefreshTokenRepository()
    oneTimeTokens = new InMemoryOneTimeTokenRepository()
    audit = new InMemoryAuditRepository()
    mail = new FakeMailService()
    service = new AuthService(users, sessions, oneTimeTokens, audit, mail)
  })

  async function register(email = 'awa@example.com') {
    return service.register(
      registerSchema.parse({
        name: 'Awa Ndiaye',
        email,
        password: 'Secret123!',
        password_confirmation: 'Secret123!',
      }),
      context,
    )
  }

  it('inscrit toujours un learner, hache le mot de passe et envoie une vérification', async () => {
    const result = await register('  AWA@EXAMPLE.COM ')
    const user = await users.findByEmail('awa@example.com')

    expect(result.user).toMatchObject({
      email: 'awa@example.com',
      role: 'learner',
      email_verified: false,
    })
    expect(result.access_token).toBeTruthy()
    expect(result.refresh_token).toBeTruthy()
    expect(user?.passwordHash).not.toBe('Secret123!')
    await expect(verifyPassword('Secret123!', user!.passwordHash)).resolves.toBe(true)
    expect(mail.verifications).toHaveLength(1)
    expect(oneTimeTokens.tokens[0]?.tokenHash).not.toBe(mail.verifications[0]?.token)
    expect(oneTimeTokens.tokens[0]?.contextHash).toBe(hashText('awa@example.com'))
    expect(audit.events.some((event) => event.eventType === 'auth.registered')).toBe(true)
  })

  it('refuse un doublon sans créer un second compte', async () => {
    await register()
    await expect(register()).rejects.toMatchObject({ code: 'EMAIL_ALREADY_USED' })
    expect(users.users.size).toBe(1)
  })

  it('connecte avec le bon mot de passe et garde un message générique sinon', async () => {
    await register()
    const result = await service.login(
      { email: 'awa@example.com', password: 'Secret123!' },
      context,
    )
    expect(result.user.email).toBe('awa@example.com')
    expect(await sessions.listActiveByUser(result.user.id)).toHaveLength(2)

    await expect(
      service.login({ email: 'awa@example.com', password: 'Erreur123!' }, context),
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: 'Email ou mot de passe incorrect.',
    })
    await expect(
      service.login({ email: 'absent@example.com', password: 'Erreur123!' }, context),
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: 'Email ou mot de passe incorrect.',
    })
  })

  it('vérifie l’email avec un token utilisable une seule fois', async () => {
    await register()
    const token = mail.verifications[0]!.token

    await expect(service.verifyEmail(token, context)).resolves.toMatchObject({
      message: expect.stringContaining('vérifiée'),
    })
    expect((await users.findByEmail('awa@example.com'))?.emailVerifiedAt).toBeInstanceOf(Date)
    await expect(service.verifyEmail(token, context)).rejects.toMatchObject({
      status: 410,
    })
  })

  it('refuse qu’un lien émis pour une ancienne adresse vérifie la nouvelle', async () => {
    const registered = await register()
    const rawToken = mail.verifications[0]!.token
    const storedToken = oneTimeTokens.tokens[0]!
    const user = await users.findById(registered.user.id)
    user!.set({ email: 'nouvelle@example.com', emailVerifiedAt: null })

    await expect(service.verifyEmail(rawToken, context)).rejects.toMatchObject({ status: 410 })
    expect(storedToken.consumedAt).toBeNull()
    expect(user!.emailVerifiedAt).toBeNull()
  })

  it('ne consomme pas le token de vérification si son utilisateur n’existe plus', async () => {
    const registered = await register()
    const rawToken = mail.verifications[0]!.token
    const storedToken = oneTimeTokens.tokens[0]!
    users.users.delete(registered.user.id)

    await expect(service.verifyEmail(rawToken, context)).rejects.toMatchObject({ status: 404 })
    expect(storedToken.consumedAt).toBeNull()
  })

  it('effectue la rotation puis détecte la réutilisation de l’ancien refresh token', async () => {
    const registered = await register()
    const rotated = await service.refresh(registered.refresh_token, context)

    expect(rotated.refresh_token).not.toBe(registered.refresh_token)
    expect(rotated.session_id).toBe(registered.session_id)
    await expect(service.refresh(registered.refresh_token, context)).rejects.toMatchObject({
      code: 'TOKEN_REUSE_DETECTED',
    })

    const family = sessions.tokens.filter(
      (token) => token.sessionId === registered.session_id,
    )
    expect(family.every((token) => token.revokedAt instanceof Date)).toBe(true)
    expect((await users.findByEmail('awa@example.com'))?.authVersion).toBe(2)
  })

  it('refuse un refresh actif si la version de sécurité du compte a changé', async () => {
    const registered = await register()
    await users.bumpAuthVersion(registered.user.id)

    await expect(service.refresh(registered.refresh_token, context)).rejects.toMatchObject({
      code: 'SESSION_REVOKED',
    })
    expect(await sessions.hasActiveSession(registered.user.id, registered.session_id)).toBe(false)
  })

  it('ne révèle pas les emails inconnus pendant mot de passe oublié', async () => {
    const response = await service.forgotPassword('absent@example.com', context)
    expect(response.message).toContain('Si cette adresse existe')
    expect(mail.resets).toHaveLength(0)
  })

  it('garde une réponse générique lorsque le serveur mail échoue', async () => {
    await register()
    mail.sendPasswordReset = async () => {
      throw new Error('SMTP indisponible')
    }

    await expect(service.forgotPassword('awa@example.com', context)).resolves.toMatchObject({
      message: expect.stringContaining('Si cette adresse existe'),
    })
    expect(
      oneTimeTokens.tokens.some((token) => token.purpose === 'reset_password'),
    ).toBe(true)
  })

  it('ne consomme pas le token de reset quand le nouveau mot de passe est identique', async () => {
    await register()
    await service.forgotPassword('awa@example.com', context)
    const token = mail.resets[0]!.token

    await expect(
      service.resetPassword(
        {
          token,
          password: 'Secret123!',
          password_confirmation: 'Secret123!',
        },
        context,
      ),
    ).rejects.toMatchObject({ status: 400 })

    await expect(
      service.resetPassword(
        {
          token,
          password: 'Nouveau456!',
          password_confirmation: 'Nouveau456!',
        },
        context,
      ),
    ).resolves.toMatchObject({ message: expect.stringContaining('réinitialisé') })
  })

  it('réinitialise le mot de passe, consomme le token et révoque les sessions', async () => {
    const registered = await register()
    await service.forgotPassword('awa@example.com', context)
    const token = mail.resets[0]!.token

    await service.resetPassword(
      {
        token,
        password: 'Nouveau456!',
        password_confirmation: 'Nouveau456!',
      },
      context,
    )

    expect(await sessions.hasActiveSession(registered.user.id, registered.session_id)).toBe(false)
    await expect(
      service.login({ email: 'awa@example.com', password: 'Secret123!' }, context),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    await expect(
      service.login({ email: 'awa@example.com', password: 'Nouveau456!' }, context),
    ).resolves.toHaveProperty('access_token')
    await expect(
      service.resetPassword(
        {
          token,
          password: 'Encore789!',
          password_confirmation: 'Encore789!',
        },
        context,
      ),
    ).rejects.toMatchObject({ status: 410 })
  })

  it('invalide les liens de reset après un changement volontaire de mot de passe', async () => {
    const registered = await register()
    await service.forgotPassword('awa@example.com', context)
    const resetToken = mail.resets[0]!.token

    await service.changePassword(
      registered.user.id,
      {
        current_password: 'Secret123!',
        password: 'Nouveau456!',
        password_confirmation: 'Nouveau456!',
      },
      context,
    )

    await expect(
      service.resetPassword(
        {
          token: resetToken,
          password: 'Encore789!',
          password_confirmation: 'Encore789!',
        },
        context,
      ),
    ).rejects.toMatchObject({ status: 410 })
  })

  it('ne traite pas comme un vol un refresh révoqué par changement de mot de passe', async () => {
    const registered = await register()
    await service.changePassword(
      registered.user.id,
      {
        current_password: 'Secret123!',
        password: 'Nouveau456!',
        password_confirmation: 'Nouveau456!',
      },
      context,
    )

    await expect(service.refresh(registered.refresh_token, context)).rejects.toMatchObject({
      code: 'SESSION_REVOKED',
    })
    expect((await users.findById(registered.user.id))?.authVersion).toBe(2)
  })

  it('change l’adresse, la rend non vérifiée et invalide les sessions', async () => {
    const registered = await register()
    const result = await service.changeEmail(
      registered.user.id,
      { email: 'nouvelle@example.com', current_password: 'Secret123!' },
      context,
    )

    expect(result.user).toMatchObject({
      email: 'nouvelle@example.com',
      email_verified: false,
    })
    expect(await sessions.hasActiveSession(registered.user.id, registered.session_id)).toBe(false)
    expect(mail.verifications.at(-1)?.email).toBe('nouvelle@example.com')
  })

  it('invalide les liens de reset envoyés à l’ancienne adresse', async () => {
    const registered = await register()
    await service.forgotPassword('awa@example.com', context)
    const resetToken = mail.resets[0]!.token

    await service.changeEmail(
      registered.user.id,
      { email: 'nouvelle@example.com', current_password: 'Secret123!' },
      context,
    )

    await expect(
      service.resetPassword(
        {
          token: resetToken,
          password: 'Nouveau456!',
          password_confirmation: 'Nouveau456!',
        },
        context,
      ),
    ).rejects.toMatchObject({ status: 410 })
  })

  it('invalide tous les liens à usage unique lors de la désactivation', async () => {
    const registered = await register()
    await service.forgotPassword('awa@example.com', context)

    await service.deactivateAccount(registered.user.id, 'Secret123!', context)

    const activeTokens = oneTimeTokens.tokens.filter((token) => !token.consumedAt)
    expect(activeTokens).toHaveLength(0)
    expect((await users.findById(registered.user.id))?.isActive).toBe(false)
  })

  it('refuse un reset si le compte a été désactivé sans brûler le lien', async () => {
    const registered = await register()
    await service.forgotPassword('awa@example.com', context)
    const resetToken = mail.resets[0]!.token
    const storedToken = oneTimeTokens.tokens.find(
      (token) => token.purpose === 'reset_password',
    )!
    await users.updateActive(registered.user.id, false)

    await expect(
      service.resetPassword(
        {
          token: resetToken,
          password: 'Nouveau456!',
          password_confirmation: 'Nouveau456!',
        },
        context,
      ),
    ).rejects.toMatchObject({ status: 410 })
    expect(storedToken.consumedAt).toBeNull()
  })

  it('liste uniquement les sessions du propriétaire et peut en révoquer une', async () => {
    const registered = await register()
    await service.login({ email: 'awa@example.com', password: 'Secret123!' }, context)
    const list = await service.listSessions(
      registered.user.id,
      registered.session_id,
    )
    expect(list).toHaveLength(2)
    expect(list.filter((session) => session.is_current)).toHaveLength(1)

    await service.revokeSession(
      registered.user.id,
      list[1]!.session_id,
      context,
    )
    expect(await service.listSessions(registered.user.id, registered.session_id)).toHaveLength(1)
  })
})
