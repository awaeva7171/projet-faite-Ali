import { randomUUID } from 'node:crypto'
import { env } from '../../config/env.js'
import { logger } from '../../config/logger.js'
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  GoneError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
} from '../../shared/errors.js'
import { hashPassword, verifyPassword } from '../../shared/password.js'
import {
  generateOpaqueToken,
  hashText,
  hashToken,
  signAccessToken,
  signRefreshToken,
  tokenExpiration,
  tokenLifetimeSeconds,
  verifyRefreshToken,
} from '../../shared/token.js'
import {
  UserRepository,
  type IUserRepository,
} from '../users/user.repository.js'
import type {
  ChangeEmailInput,
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from './auth.schema.js'
import {
  AuthAuditRepository,
  type IAuthAuditRepository,
} from './auth-audit.repository.js'
import { createMailService, type IMailService } from './mail.service.js'
import {
  OneTimeTokenRepository,
  type IOneTimeTokenRepository,
} from './one-time-token.repository.js'
import {
  RefreshTokenRepository,
  type IRefreshTokenRepository,
  type NewRefreshToken,
} from './refresh-token.repository.js'

const dummyPasswordHash = hashPassword('InvalidPassword123!')

export interface SessionContext {
  ipAddress?: string | null
  userAgent?: string | null
}

export class AuthService {
  constructor(
    private readonly users: IUserRepository = new UserRepository(),
    private readonly refreshTokens: IRefreshTokenRepository = new RefreshTokenRepository(),
    private readonly oneTimeTokens: IOneTimeTokenRepository = new OneTimeTokenRepository(),
    private readonly audit: IAuthAuditRepository = new AuthAuditRepository(),
    private readonly mail: IMailService = createMailService(),
  ) {}

  async register(input: RegisterInput, context: SessionContext) {
    if (await this.users.findByEmail(input.email)) {
      throw new ConflictError(
        'Cette adresse email possède déjà un compte.',
        undefined,
        'EMAIL_ALREADY_USED',
      )
    }

    const user = await this.users.create({
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: 'learner',
    })
    const verificationToken = await this.issueOneTimeToken(
      user.id,
      'verify_email',
      env.EMAIL_VERIFICATION_TTL_MINUTES,
      context,
      user.email,
    )
    await this.mail.sendEmailVerification(user, verificationToken)
    const tokens = await this.issueTokens(user, context)
    await this.recordAudit('auth.registered', 'success', user.id, user.email, context)

    return {
      user: user.toSafeJSON(),
      ...tokens,
      verification_required: true,
      message: 'Consultez votre messagerie pour vérifier votre adresse.',
      ...(env.AUTH_EXPOSE_DEBUG_TOKENS
        ? { debug: { verification_token: verificationToken } }
        : {}),
    }
  }

  async login(input: LoginInput, context: SessionContext) {
    const user = await this.users.findByEmail(input.email)
    const hash = user?.passwordHash ?? (await dummyPasswordHash)
    const validPassword = await verifyPassword(input.password, hash)
    const now = new Date()

    if (user?.lockedUntil && user.lockedUntil > now) {
      await this.recordAudit('auth.login.failed', 'failure', user.id, user.email, context, {
        reason: 'locked',
      })
      throw new TooManyRequestsError('Ce compte est temporairement verrouillé.')
    }

    if (!user || !validPassword || !user.isActive) {
      if (user && user.isActive && !validPassword) {
        const attempts = user.failedLoginAttempts + 1
        const lockedUntil =
          attempts >= env.LOGIN_MAX_ATTEMPTS
            ? new Date(now.getTime() + env.LOGIN_LOCK_MINUTES * 60_000)
            : null
        await this.users.recordLoginFailure(user.id, attempts, lockedUntil)
        await this.recordAudit('auth.login.failed', 'failure', user.id, user.email, context, {
          reason: lockedUntil ? 'too_many_attempts' : 'invalid_credentials',
        })
        if (lockedUntil) throw new TooManyRequestsError('Ce compte est temporairement verrouillé.')
      } else {
        await this.recordAudit('auth.login.failed', 'failure', user?.id, input.email, context, {
          reason: 'invalid_credentials',
        })
      }
      throw new UnauthorizedError('Email ou mot de passe incorrect.', 'INVALID_CREDENTIALS')
    }

    const updatedUser = (await this.users.recordLoginSuccess(user.id, now)) ?? user
    const tokens = await this.issueTokens(updatedUser, context)
    await this.recordAudit('auth.login.succeeded', 'success', user.id, user.email, context, {
      session_id: tokens.session_id,
    })
    return { user: updatedUser.toSafeJSON(), ...tokens }
  }

  async refresh(rawToken: string, context: SessionContext) {
    let payload
    try {
      payload = verifyRefreshToken(rawToken)
    } catch {
      throw new UnauthorizedError(
        'Le jeton de renouvellement est invalide ou expiré.',
        'INVALID_REFRESH_TOKEN',
      )
    }

    const current = await this.refreshTokens.findByHash(hashToken(rawToken))
    if (
      !current ||
      current.userId !== payload.sub ||
      current.sessionId !== payload.sid ||
      current.jwtId !== payload.jti
    ) {
      throw new UnauthorizedError('Session de renouvellement introuvable.', 'INVALID_REFRESH_TOKEN')
    }

    if (current.replacedById || current.revokeReason === 'rotated') {
      await this.handleRefreshReuse(current.userId, current.sessionId, context)
    }
    if (current.revokedAt) {
      throw new UnauthorizedError('Cette session a été révoquée.', 'SESSION_REVOKED')
    }
    if (current.expiresAt <= new Date()) {
      throw new UnauthorizedError('Cette session a expiré.', 'INVALID_REFRESH_TOKEN')
    }

    const user = await this.users.findById(payload.sub)
    if (!user?.isActive) {
      throw new UnauthorizedError('Ce compte n’est plus actif.', 'ACCOUNT_DISABLED')
    }
    if (user.authVersion !== payload.ver) {
      await this.refreshTokens.revokeFamily(current.sessionId, 'auth_version_changed')
      throw new UnauthorizedError('Cette session a été révoquée.', 'SESSION_REVOKED')
    }

    const next = this.buildRefreshRecord(
      user.id,
      current.sessionId,
      user.authVersion,
      context,
    )
    const rotated = await this.refreshTokens.rotate(current.id, next.record)
    if (!rotated) await this.handleRefreshReuse(user.id, current.sessionId, context)

    await this.recordAudit('auth.token.refreshed', 'success', user.id, user.email, context, {
      session_id: current.sessionId,
    })
    return this.tokenPair(user, current.sessionId, next.rawToken)
  }

  async logout(rawToken: string, context: SessionContext): Promise<void> {
    const current = await this.refreshTokens.findByHash(hashToken(rawToken))
    if (!current) return
    await this.refreshTokens.revokeFamily(current.sessionId, 'logout')
    const user = await this.users.findById(current.userId)
    await this.recordAudit('auth.logout', 'success', current.userId, user?.email, context, {
      session_id: current.sessionId,
    })
  }

  async logoutAll(userId: string, context: SessionContext): Promise<void> {
    const user = await this.requireUser(userId)
    await this.refreshTokens.revokeAllForUser(userId, 'logout_all')
    await this.users.bumpAuthVersion(userId)
    await this.recordAudit('auth.logout_all', 'success', userId, user.email, context)
  }

  async me(userId: string) {
    return (await this.requireUser(userId)).toSafeJSON()
  }

  async updateProfile(userId: string, name: string) {
    const user = await this.users.updateName(userId, name)
    if (!user) throw new NotFoundError('Utilisateur introuvable.')
    return user.toSafeJSON()
  }

  async changePassword(userId: string, input: ChangePasswordInput, context: SessionContext) {
    const user = await this.requireUser(userId)
    if (!(await verifyPassword(input.current_password, user.passwordHash))) {
      throw new UnauthorizedError('Le mot de passe actuel est incorrect.', 'INVALID_PASSWORD')
    }
    if (await verifyPassword(input.password, user.passwordHash)) {
      throw new BadRequestError('Le nouveau mot de passe doit être différent de l’ancien.')
    }

    await this.users.updatePassword(userId, await hashPassword(input.password), new Date())
    await this.oneTimeTokens.invalidateForUser(userId, 'reset_password')
    await this.refreshTokens.revokeAllForUser(userId, 'password_changed')
    await this.recordAudit('auth.password.changed', 'success', userId, user.email, context)
    return { message: 'Mot de passe modifié. Reconnectez-vous sur vos appareils.' }
  }

  async forgotPassword(email: string, context: SessionContext) {
    const user = await this.users.findByEmail(email)
    let rawToken: string | undefined
    if (user?.isActive) {
      rawToken = await this.issueOneTimeToken(
        user.id,
        'reset_password',
        env.PASSWORD_RESET_TTL_MINUTES,
        context,
        `reset:${user.authVersion}`,
      )
      // La réponse de récupération ne doit pas dépendre de la latence ni de la
      // disponibilité du serveur SMTP : cela révélerait si l'adresse existe.
      // Une file d'attente persistante reste préférable en production ; ce
      // lancement asynchrone constitue le repli sûr du kit pédagogique.
      void Promise.resolve()
        .then(() => this.mail.sendPasswordReset(user, rawToken!))
        .catch((error) => {
          logger.warn(
            { error, userId: user.id },
            'Impossible d’envoyer l’email de réinitialisation du mot de passe.',
          )
        })
      await this.recordAudit('auth.password.reset_requested', 'success', user.id, user.email, context)
    } else {
      await this.recordAudit('auth.password.reset_requested', 'success', undefined, email, context)
    }
    return {
      message: 'Si cette adresse existe, un lien de réinitialisation a été envoyé.',
      ...(env.AUTH_EXPOSE_DEBUG_TOKENS && rawToken
        ? { debug: { reset_token: rawToken } }
        : {}),
    }
  }

  async resetPassword(input: ResetPasswordInput, context: SessionContext) {
    const token = await this.oneTimeTokens.findByHash(
      hashToken(input.token),
      'reset_password',
    )
    if (!token || token.consumedAt || token.expiresAt <= new Date()) {
      throw new GoneError()
    }
    const user = await this.requireUser(token.userId)
    if (
      !user.isActive ||
      !token.contextHash ||
      token.contextHash !== hashText(`reset:${user.authVersion}`)
    ) {
      throw new GoneError()
    }
    if (await verifyPassword(input.password, user.passwordHash)) {
      throw new BadRequestError('Le nouveau mot de passe doit être différent de l’ancien.')
    }
    const passwordHash = await hashPassword(input.password)

    // Valider toutes les préconditions avant la consommation atomique. Ainsi,
    // une erreur corrigeable (par exemple le même mot de passe) ne détruit pas
    // un lien encore valable.
    if (!(await this.oneTimeTokens.claim(token.id))) throw new GoneError()

    await this.users.updatePassword(user.id, passwordHash, new Date())
    await this.refreshTokens.revokeAllForUser(user.id, 'password_reset')
    await this.recordAudit('auth.password.reset', 'success', user.id, user.email, context)
    return { message: 'Mot de passe réinitialisé. Vous pouvez maintenant vous connecter.' }
  }

  async resendVerification(userId: string, context: SessionContext) {
    const user = await this.requireUser(userId)
    if (user.emailVerifiedAt) {
      return { message: 'Cette adresse email est déjà vérifiée.' }
    }
    const rawToken = await this.issueOneTimeToken(
      user.id,
      'verify_email',
      env.EMAIL_VERIFICATION_TTL_MINUTES,
      context,
      user.email,
    )
    await this.mail.sendEmailVerification(user, rawToken)
    await this.recordAudit('auth.email.verification_requested', 'success', user.id, user.email, context)
    return {
      message: 'Un nouveau lien de vérification a été envoyé.',
      ...(env.AUTH_EXPOSE_DEBUG_TOKENS
        ? { debug: { verification_token: rawToken } }
        : {}),
    }
  }

  async verifyEmail(rawToken: string, context: SessionContext) {
    const token = await this.oneTimeTokens.findByHash(hashToken(rawToken), 'verify_email')
    if (!token || token.consumedAt || token.expiresAt <= new Date()) throw new GoneError()
    const user = await this.requireUser(token.userId)
    if (!user.isActive || !token.contextHash || token.contextHash !== hashText(user.email)) {
      throw new GoneError()
    }

    // Ne consommer le lien qu'après avoir vérifié que sa cible existe encore.
    if (!(await this.oneTimeTokens.claim(token.id))) throw new GoneError()

    await this.users.markEmailVerified(user.id, new Date())
    await this.recordAudit('auth.email.verified', 'success', user.id, user.email, context)
    return { message: 'Adresse email vérifiée avec succès.' }
  }

  async changeEmail(userId: string, input: ChangeEmailInput, context: SessionContext) {
    const user = await this.requireUser(userId)
    if (!(await verifyPassword(input.current_password, user.passwordHash))) {
      throw new UnauthorizedError('Le mot de passe actuel est incorrect.', 'INVALID_PASSWORD')
    }
    if (input.email === user.email) throw new BadRequestError('Cette adresse est déjà utilisée par ce compte.')
    if (await this.users.findByEmail(input.email)) {
      throw new ConflictError('Cette adresse email est déjà utilisée.', undefined, 'EMAIL_ALREADY_USED')
    }

    const updated = await this.users.changeEmail(user.id, input.email)
    if (!updated) throw new NotFoundError('Utilisateur introuvable.')
    await this.oneTimeTokens.invalidateForUser(user.id, 'reset_password')
    await this.refreshTokens.revokeAllForUser(user.id, 'email_changed')
    const rawToken = await this.issueOneTimeToken(
      user.id,
      'verify_email',
      env.EMAIL_VERIFICATION_TTL_MINUTES,
      context,
      updated.email,
    )
    await this.mail.sendEmailVerification(updated, rawToken)
    await this.recordAudit('auth.email.changed', 'success', user.id, updated.email, context)
    return {
      user: updated.toSafeJSON(),
      message: 'Adresse modifiée. Vérifiez-la puis reconnectez-vous.',
      ...(env.AUTH_EXPOSE_DEBUG_TOKENS
        ? { debug: { verification_token: rawToken } }
        : {}),
    }
  }

  async listSessions(userId: string, currentSessionId: string) {
    const sessions = await this.refreshTokens.listActiveByUser(userId)
    return sessions.map((session) => session.toSessionJSON(currentSessionId))
  }

  async revokeSession(userId: string, sessionId: string, context: SessionContext) {
    const revoked = await this.refreshTokens.revokeSession(userId, sessionId, 'user_revoked')
    if (!revoked) throw new NotFoundError('Session active introuvable.')
    const user = await this.requireUser(userId)
    await this.recordAudit('auth.session.revoked', 'success', userId, user.email, context, {
      session_id: sessionId,
    })
    return { message: 'Session révoquée.' }
  }

  async deactivateAccount(
    userId: string,
    currentPassword: string,
    context: SessionContext,
  ) {
    const user = await this.requireUser(userId)
    if (user.role === 'admin') {
      throw new ForbiddenError(
        'Un administrateur doit faire désactiver son compte par un autre administrateur.',
      )
    }
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new UnauthorizedError('Le mot de passe actuel est incorrect.', 'INVALID_PASSWORD')
    }
    await this.users.updateActive(userId, false)
    await this.refreshTokens.revokeAllForUser(userId, 'account_deactivated')
    await this.oneTimeTokens.invalidateForUser(userId)
    await this.recordAudit('auth.account.deactivated', 'success', userId, user.email, context)
    return { message: 'Compte désactivé.' }
  }

  private async issueTokens(
    user: { id: string; email: string; role: 'admin' | 'teacher' | 'learner'; authVersion: number },
    context: SessionContext,
  ) {
    const sessionId = randomUUID()
    const refresh = this.buildRefreshRecord(user.id, sessionId, user.authVersion, context)
    await this.refreshTokens.create(refresh.record)
    return this.tokenPair(user, sessionId, refresh.rawToken)
  }

  private tokenPair(
    user: { id: string; email: string; role: 'admin' | 'teacher' | 'learner'; authVersion: number },
    sessionId: string,
    refreshToken: string,
  ) {
    const accessToken = signAccessToken(user, sessionId)
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: tokenLifetimeSeconds(accessToken),
      session_id: sessionId,
    }
  }

  private buildRefreshRecord(
    userId: string,
    sessionId: string,
    authVersion: number,
    context: SessionContext,
  ): { rawToken: string; record: NewRefreshToken } {
    const signed = signRefreshToken(userId, sessionId, authVersion)
    return {
      rawToken: signed.token,
      record: {
        userId,
        sessionId,
        tokenHash: hashToken(signed.token),
        jwtId: signed.jti,
        expiresAt: tokenExpiration(signed.token),
        userAgent: context.userAgent ?? null,
        ipAddress: context.ipAddress ?? null,
        lastUsedAt: new Date(),
      },
    }
  }

  private async issueOneTimeToken(
    userId: string,
    purpose: 'verify_email' | 'reset_password',
    ttlMinutes: number,
    context: SessionContext,
    contextValue?: string,
  ): Promise<string> {
    if (!contextValue) {
      throw new Error('Un contexte cible est obligatoire pour un jeton à usage unique.')
    }
    const rawToken = generateOpaqueToken()
    await this.oneTimeTokens.issue({
      userId,
      purpose,
      tokenHash: hashToken(rawToken),
      contextHash: contextValue ? hashText(contextValue) : null,
      expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
      requestedIp: context.ipAddress ?? null,
    })
    return rawToken
  }

  private async handleRefreshReuse(
    userId: string,
    sessionId: string,
    context: SessionContext,
  ): Promise<never> {
    await this.refreshTokens.revokeFamily(sessionId, 'reuse_detected', true)
    const user = await this.users.bumpAuthVersion(userId)
    await this.recordAudit('auth.refresh.reuse_detected', 'failure', userId, user?.email, context, {
      session_id: sessionId,
    })
    throw new UnauthorizedError(
      'Réutilisation d’un ancien jeton détectée. La session a été révoquée.',
      'TOKEN_REUSE_DETECTED',
    )
  }

  private async requireUser(userId: string) {
    const user = await this.users.findById(userId)
    if (!user) throw new NotFoundError('Utilisateur introuvable.')
    return user
  }

  private async recordAudit(
    eventType: string,
    status: 'success' | 'failure',
    userId: string | undefined,
    email: string | undefined,
    context: SessionContext,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.audit.create({
        userId: userId ?? null,
        eventType,
        status,
        emailHash: email ? hashText(email) : null,
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
        metadata: metadata ?? null,
      })
    } catch (error) {
      logger.warn({ error, eventType }, 'Impossible d’écrire l’événement d’audit.')
    }
  }
}
