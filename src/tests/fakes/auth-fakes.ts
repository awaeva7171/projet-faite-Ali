import { randomUUID } from 'node:crypto'
import { initializeModels } from '../../database/models.js'
import type {
  AuditEventInput,
  IAuthAuditRepository,
} from '../../modules/auth/auth-audit.repository.js'
import { AuthAuditEvent } from '../../modules/auth/auth-audit-event.model.js'
import type {
  IMailService,
  MailRecipient,
} from '../../modules/auth/mail.service.js'
import { OneTimeToken } from '../../modules/auth/one-time-token.model.js'
import type { IOneTimeTokenRepository } from '../../modules/auth/one-time-token.repository.js'
import { RefreshToken } from '../../modules/auth/refresh-token.model.js'
import type {
  IRefreshTokenRepository,
  NewRefreshToken,
} from '../../modules/auth/refresh-token.repository.js'
import { User, type UserRole } from '../../modules/users/user.model.js'
import type {
  CreateUserRecord,
  GuardedUserUpdate,
  IUserRepository,
  ListUsersInput,
} from '../../modules/users/user.repository.js'

initializeModels()

export class InMemoryUserRepository implements IUserRepository {
  readonly users = new Map<string, User>()

  findById(id: string): Promise<User | null> {
    return Promise.resolve(this.users.get(id) ?? null)
  }

  findByEmail(email: string): Promise<User | null> {
    const normalized = email.trim().toLowerCase()
    return Promise.resolve(
      [...this.users.values()].find((user) => user.email === normalized) ?? null,
    )
  }

  create(data: CreateUserRecord): Promise<User> {
    const now = new Date()
    const user = User.build(
      {
        id: randomUUID(),
        name: data.name,
        email: data.email.trim().toLowerCase(),
        passwordHash: data.passwordHash,
        role: data.role ?? 'learner',
        isActive: data.isActive ?? true,
        emailVerifiedAt: data.emailVerifiedAt ?? null,
        authVersion: 1,
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: null,
        passwordChangedAt: null,
        createdAt: now,
        updatedAt: now,
      },
      { isNewRecord: false },
    )
    this.users.set(user.id, user)
    return Promise.resolve(user)
  }

  async updateName(id: string, name: string): Promise<User | null> {
    const user = await this.findById(id)
    if (user) user.set({ name, updatedAt: new Date() })
    return user
  }

  async changeEmail(id: string, email: string): Promise<User | null> {
    const user = await this.findById(id)
    if (user) {
      user.set({
        email: email.trim().toLowerCase(),
        emailVerifiedAt: null,
        authVersion: user.authVersion + 1,
        updatedAt: new Date(),
      })
    }
    return user
  }

  async markEmailVerified(id: string, at: Date): Promise<User | null> {
    const user = await this.findById(id)
    if (user) user.set({ emailVerifiedAt: at, updatedAt: at })
    return user
  }

  async recordLoginFailure(
    id: string,
    attempts: number,
    lockedUntil: Date | null,
  ): Promise<void> {
    const user = await this.findById(id)
    user?.set({ failedLoginAttempts: attempts, lockedUntil })
  }

  async recordLoginSuccess(id: string, at: Date): Promise<User | null> {
    const user = await this.findById(id)
    if (user) {
      user.set({
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: at,
        updatedAt: at,
      })
    }
    return user
  }

  async updatePassword(id: string, passwordHash: string, at: Date): Promise<User | null> {
    const user = await this.findById(id)
    if (user) {
      user.set({
        passwordHash,
        passwordChangedAt: at,
        authVersion: user.authVersion + 1,
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: at,
      })
    }
    return user
  }

  async bumpAuthVersion(id: string): Promise<User | null> {
    const user = await this.findById(id)
    if (user) user.set({ authVersion: user.authVersion + 1 })
    return user
  }

  async list(input: ListUsersInput) {
    let rows = [...this.users.values()]
    if (input.role) rows = rows.filter((user) => user.role === input.role)
    if (input.isActive !== undefined) {
      rows = rows.filter((user) => user.isActive === input.isActive)
    }
    if (input.isVerified !== undefined) {
      rows = rows.filter(
        (user) => (user.emailVerifiedAt !== null) === input.isVerified,
      )
    }
    if (input.search) {
      const search = input.search.toLowerCase()
      rows = rows.filter(
        (user) =>
          user.name.toLowerCase().includes(search) ||
          user.email.toLowerCase().includes(search),
      )
    }
    const count = rows.length
    const offset = (input.page - 1) * input.perPage
    return { rows: rows.slice(offset, offset + input.perPage), count }
  }

  countActiveAdmins(): Promise<number> {
    return Promise.resolve(
      [...this.users.values()].filter(
        (user) => user.role === 'admin' && user.isActive,
      ).length,
    )
  }

  async updateRole(id: string, role: UserRole): Promise<User | null> {
    const user = await this.findById(id)
    if (user) user.set({ role, authVersion: user.authVersion + 1 })
    return user
  }

  async updateActive(id: string, isActive: boolean): Promise<User | null> {
    const user = await this.findById(id)
    if (user) user.set({ isActive, authVersion: user.authVersion + 1 })
    return user
  }

  async updateRoleGuarded(id: string, role: UserRole): Promise<GuardedUserUpdate> {
    const user = await this.findById(id)
    if (!user) return { status: 'not_found' }
    if (
      user.role === 'admin' &&
      user.isActive &&
      role !== 'admin' &&
      (await this.countActiveAdmins()) <= 1
    ) {
      return { status: 'last_active_admin' }
    }
    user.set({ role, authVersion: user.authVersion + 1 })
    return { status: 'updated', user }
  }

  async updateActiveGuarded(id: string, isActive: boolean): Promise<GuardedUserUpdate> {
    const user = await this.findById(id)
    if (!user) return { status: 'not_found' }
    if (
      user.role === 'admin' &&
      user.isActive &&
      !isActive &&
      (await this.countActiveAdmins()) <= 1
    ) {
      return { status: 'last_active_admin' }
    }
    user.set({ isActive, authVersion: user.authVersion + 1 })
    return { status: 'updated', user }
  }
}

export class InMemoryRefreshTokenRepository implements IRefreshTokenRepository {
  readonly tokens: RefreshToken[] = []

  create(data: NewRefreshToken): Promise<RefreshToken> {
    const now = new Date()
    const token = RefreshToken.build(
      {
        id: randomUUID(),
        ...data,
        revokedAt: null,
        revokeReason: null,
        replacedById: null,
        reuseDetectedAt: null,
        userAgent: data.userAgent ?? null,
        ipAddress: data.ipAddress ?? null,
        lastUsedAt: data.lastUsedAt ?? null,
        createdAt: now,
        updatedAt: now,
      },
      { isNewRecord: false },
    )
    this.tokens.push(token)
    return Promise.resolve(token)
  }

  findByHash(hash: string): Promise<RefreshToken | null> {
    return Promise.resolve(this.tokens.find((token) => token.tokenHash === hash) ?? null)
  }

  async rotate(currentId: string, next: NewRefreshToken): Promise<RefreshToken | null> {
    const current = this.tokens.find((token) => token.id === currentId)
    if (!current || current.revokedAt || current.expiresAt <= new Date()) return null
    const created = await this.create(next)
    current.set({
      revokedAt: new Date(),
      revokeReason: 'rotated',
      replacedById: created.id,
      lastUsedAt: new Date(),
    })
    return created
  }

  async revokeFamily(sessionId: string, reason: string, reuseDetected = false) {
    const now = new Date()
    for (const token of this.tokens.filter((item) => item.sessionId === sessionId)) {
      if (!token.revokedAt) token.set({ revokedAt: now, revokeReason: reason })
      if (reuseDetected) token.set({ reuseDetectedAt: now })
    }
  }

  async revokeSession(userId: string, sessionId: string, reason: string) {
    const active = this.tokens.filter(
      (token) =>
        token.userId === userId &&
        token.sessionId === sessionId &&
        !token.revokedAt,
    )
    for (const token of active) token.set({ revokedAt: new Date(), revokeReason: reason })
    return active.length > 0
  }

  async revokeAllForUser(userId: string, reason: string) {
    for (const token of this.tokens.filter(
      (item) => item.userId === userId && !item.revokedAt,
    )) {
      token.set({ revokedAt: new Date(), revokeReason: reason })
    }
  }

  listActiveByUser(userId: string): Promise<RefreshToken[]> {
    return Promise.resolve(
      this.tokens.filter(
        (token) =>
          token.userId === userId &&
          !token.revokedAt &&
          token.expiresAt > new Date(),
      ),
    )
  }

  async hasActiveSession(userId: string, sessionId: string) {
    return this.tokens.some(
      (token) =>
        token.userId === userId &&
        token.sessionId === sessionId &&
        !token.revokedAt &&
        token.expiresAt > new Date(),
    )
  }

  purgeOlderThan(date: Date): Promise<number> {
    const before = this.tokens.length
    const kept = this.tokens.filter(
      (token) =>
        token.expiresAt >= date &&
        (!token.revokedAt || token.revokedAt >= date),
    )
    this.tokens.splice(0, this.tokens.length, ...kept)
    return Promise.resolve(before - kept.length)
  }
}

export class InMemoryOneTimeTokenRepository implements IOneTimeTokenRepository {
  readonly tokens: OneTimeToken[] = []

  async issue(data: {
    userId: string
    purpose: 'verify_email' | 'reset_password'
    tokenHash: string
    contextHash?: string | null
    expiresAt: Date
    requestedIp?: string | null
  }) {
    const now = new Date()
    for (const token of this.tokens.filter(
      (item) =>
        item.userId === data.userId &&
        item.purpose === data.purpose &&
        !item.consumedAt,
    )) {
      token.set({ consumedAt: now })
    }
    const token = OneTimeToken.build(
      {
        id: randomUUID(),
        ...data,
        contextHash: data.contextHash ?? null,
        requestedIp: data.requestedIp ?? null,
        consumedAt: null,
        createdAt: now,
        updatedAt: now,
      },
      { isNewRecord: false },
    )
    this.tokens.push(token)
    return token
  }

  findByHash(tokenHash: string, purpose: 'verify_email' | 'reset_password') {
    return Promise.resolve(
      this.tokens.find(
        (token) => token.tokenHash === tokenHash && token.purpose === purpose,
      ) ?? null,
    )
  }

  async claim(id: string) {
    const token = this.tokens.find((item) => item.id === id)
    if (!token || token.consumedAt || token.expiresAt <= new Date()) return false
    token.set({ consumedAt: new Date() })
    return true
  }

  async invalidateForUser(
    userId: string,
    purpose?: 'verify_email' | 'reset_password',
  ) {
    const now = new Date()
    let count = 0
    for (const token of this.tokens) {
      if (
        token.userId === userId &&
        (!purpose || token.purpose === purpose) &&
        !token.consumedAt
      ) {
        token.set({ consumedAt: now })
        count += 1
      }
    }
    return count
  }

  purgeOlderThan(date: Date): Promise<number> {
    const before = this.tokens.length
    const kept = this.tokens.filter(
      (token) =>
        token.expiresAt >= date &&
        (!token.consumedAt || token.consumedAt >= date),
    )
    this.tokens.splice(0, this.tokens.length, ...kept)
    return Promise.resolve(before - kept.length)
  }
}

export class InMemoryAuditRepository implements IAuthAuditRepository {
  readonly events: AuditEventInput[] = []

  async create(data: AuditEventInput): Promise<void> {
    this.events.push(data)
  }

  listForUser(_userId: string): Promise<AuthAuditEvent[]> {
    return Promise.resolve([])
  }
}

export class FakeMailService implements IMailService {
  readonly verifications: Array<MailRecipient & { token: string }> = []
  readonly resets: Array<MailRecipient & { token: string }> = []

  async sendEmailVerification(user: MailRecipient, token: string): Promise<void> {
    this.verifications.push({ name: user.name, email: user.email, token })
  }

  async sendPasswordReset(user: MailRecipient, token: string): Promise<void> {
    this.resets.push({ name: user.name, email: user.email, token })
  }
}
