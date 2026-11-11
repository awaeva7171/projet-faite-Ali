import { AuthAuditEvent } from './auth-audit-event.model.js'

export interface AuditEventInput {
  userId?: string | null
  eventType: string
  status?: 'success' | 'failure'
  emailHash?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  metadata?: Record<string, unknown> | null
}

export interface IAuthAuditRepository {
  create(data: AuditEventInput): Promise<void>
  listForUser(userId: string, limit?: number): Promise<AuthAuditEvent[]>
}

export class AuthAuditRepository implements IAuthAuditRepository {
  async create(data: AuditEventInput): Promise<void> {
    await AuthAuditEvent.create(data)
  }

  listForUser(userId: string, limit = 50): Promise<AuthAuditEvent[]> {
    return AuthAuditEvent.findAll({
      where: { userId },
      limit,
      order: [['createdAt', 'DESC']],
    })
  }
}
