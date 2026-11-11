import {
  AuthAuditRepository,
  type IAuthAuditRepository,
} from '../auth/auth-audit.repository.js'
import {
  RefreshTokenRepository,
  type IRefreshTokenRepository,
} from '../auth/refresh-token.repository.js'
import { logger } from '../../config/logger.js'
import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors.js'
import { hashPassword } from '../../shared/password.js'
import type { UserRole } from './user.model.js'
import {
  UserRepository,
  type IUserRepository,
  type ListUsersInput,
} from './user.repository.js'

export class UserService {
  constructor(
    private readonly users: IUserRepository = new UserRepository(),
    private readonly sessions: IRefreshTokenRepository = new RefreshTokenRepository(),
    private readonly audit: IAuthAuditRepository = new AuthAuditRepository(),
  ) {}

  async create(actorId: string, input: {
    name: string
    email: string
    password: string
    role: UserRole
    is_active: boolean
    email_verified: boolean
  }) {
    if (await this.users.findByEmail(input.email)) {
      throw new ConflictError('Cette adresse email est déjà utilisée.', undefined, 'EMAIL_ALREADY_USED')
    }
    const user = await this.users.create({
      name: input.name,
      email: input.email,
      role: input.role,
      isActive: input.is_active,
      emailVerifiedAt: input.email_verified ? new Date() : null,
      passwordHash: await hashPassword(input.password),
    })
    await this.recordAudit({
      userId: user.id,
      eventType: 'auth.user.admin_created',
      metadata: { actor_id: actorId, role: user.role },
    })
    return user.toSafeJSON()
  }

  async show(userId: string) {
    const user = await this.users.findById(userId)
    if (!user) throw new NotFoundError('Utilisateur introuvable.')
    return user.toSafeJSON()
  }

  async list(input: ListUsersInput) {
    const result = await this.users.list(input)
    return {
      users: result.rows.map((user) => user.toSafeJSON()),
      pagination: {
        page: input.page,
        per_page: input.perPage,
        total: result.count,
        total_pages: Math.ceil(result.count / input.perPage),
      },
    }
  }

  async updateRole(actorId: string, userId: string, role: UserRole) {
    const target = await this.requireUser(userId)
    if (actorId === userId && role !== 'admin') {
      throw new ForbiddenError('Un administrateur ne peut pas retirer son propre rôle.')
    }
    const result = await this.users.updateRoleGuarded(userId, role)
    if (result.status === 'not_found') throw new NotFoundError('Utilisateur introuvable.')
    if (result.status === 'last_active_admin') {
      throw new ForbiddenError('Le dernier administrateur actif doit être conservé.')
    }
    const user = result.user
    await this.sessions.revokeAllForUser(userId, 'role_changed')
    await this.recordAudit({
      userId,
      eventType: 'auth.role.changed',
      metadata: { actor_id: actorId, previous_role: target.role, role },
    })
    return user.toSafeJSON()
  }

  async updateActive(actorId: string, userId: string, isActive: boolean) {
    const target = await this.requireUser(userId)
    if (actorId === userId && !isActive) {
      throw new ForbiddenError('Vous ne pouvez pas désactiver votre propre compte administrateur.')
    }
    const result = await this.users.updateActiveGuarded(userId, isActive)
    if (result.status === 'not_found') throw new NotFoundError('Utilisateur introuvable.')
    if (result.status === 'last_active_admin') {
      throw new ForbiddenError('Le dernier administrateur actif doit être conservé.')
    }
    const user = result.user
    if (!isActive) await this.sessions.revokeAllForUser(userId, 'admin_deactivated')
    await this.recordAudit({
      userId,
      eventType: isActive ? 'auth.account.activated' : 'auth.account.disabled',
      metadata: { actor_id: actorId },
    })
    return user.toSafeJSON()
  }

  async revokeSessions(actorId: string, userId: string) {
    const target = await this.requireUser(userId)
    await this.sessions.revokeAllForUser(userId, 'admin_revoked')
    await this.users.bumpAuthVersion(userId)
    await this.recordAudit({
      userId,
      eventType: 'auth.sessions.admin_revoked',
      metadata: { actor_id: actorId },
    })
    return { message: `Sessions de ${target.name} révoquées.` }
  }

  async securityEvents(userId: string) {
    await this.requireUser(userId)
    const events = await this.audit.listForUser(userId)
    return events.map((event) => ({
      id: event.id,
      type: event.eventType,
      status: event.status,
      ip_address: event.ipAddress,
      user_agent: event.userAgent,
      metadata: event.metadata,
      created_at: event.createdAt,
    }))
  }

  private async requireUser(id: string) {
    const user = await this.users.findById(id)
    if (!user) throw new NotFoundError('Utilisateur introuvable.')
    return user
  }

  private async recordAudit(data: Parameters<IAuthAuditRepository['create']>[0]) {
    try {
      await this.audit.create(data)
    } catch (error) {
      // L'audit est important, mais son indisponibilité ne doit pas transformer
      // une mutation déjà validée en réponse 500 trompeuse.
      logger.warn(
        { error, eventType: data.eventType, userId: data.userId },
        'Impossible d’écrire l’événement d’audit administrateur.',
      )
    }
  }
}
