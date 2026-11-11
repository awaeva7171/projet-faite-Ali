import { Op } from 'sequelize'
import { sequelize } from '../../database/sequelize.js'
import { RefreshToken } from './refresh-token.model.js'

export interface NewRefreshToken {
  userId: string
  sessionId: string
  tokenHash: string
  jwtId: string
  expiresAt: Date
  userAgent?: string | null
  ipAddress?: string | null
  lastUsedAt?: Date | null
}

export interface IRefreshTokenRepository {
  create(data: NewRefreshToken): Promise<RefreshToken>
  findByHash(hash: string): Promise<RefreshToken | null>
  rotate(currentId: string, next: NewRefreshToken): Promise<RefreshToken | null>
  revokeFamily(sessionId: string, reason: string, reuseDetected?: boolean): Promise<void>
  revokeSession(userId: string, sessionId: string, reason: string): Promise<boolean>
  revokeAllForUser(userId: string, reason: string): Promise<void>
  listActiveByUser(userId: string): Promise<RefreshToken[]>
  hasActiveSession(userId: string, sessionId: string): Promise<boolean>
  purgeOlderThan(date: Date): Promise<number>
}

export class RefreshTokenRepository implements IRefreshTokenRepository {
  create(data: NewRefreshToken): Promise<RefreshToken> {
    return RefreshToken.create(data)
  }

  findByHash(hash: string): Promise<RefreshToken | null> {
    return RefreshToken.findOne({ where: { tokenHash: hash } })
  }

  async rotate(currentId: string, next: NewRefreshToken): Promise<RefreshToken | null> {
    return sequelize.transaction(async (transaction) => {
      const current = await RefreshToken.findByPk(currentId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      })
      if (!current || current.revokedAt || current.expiresAt <= new Date()) return null

      const created = await RefreshToken.create(next, { transaction })
      await current.update(
        {
          revokedAt: new Date(),
          revokeReason: 'rotated',
          replacedById: created.id,
          lastUsedAt: new Date(),
        },
        { transaction },
      )
      return created
    })
  }

  async revokeFamily(sessionId: string, reason: string, reuseDetected = false): Promise<void> {
    const now = new Date()
    await RefreshToken.update(
      {
        revokedAt: now,
        revokeReason: reason,
        ...(reuseDetected ? { reuseDetectedAt: now } : {}),
      },
      { where: { sessionId, revokedAt: null } },
    )
    if (reuseDetected) {
      await RefreshToken.update(
        { reuseDetectedAt: now },
        { where: { sessionId } },
      )
    }
  }

  async revokeSession(userId: string, sessionId: string, reason: string): Promise<boolean> {
    const [count] = await RefreshToken.update(
      { revokedAt: new Date(), revokeReason: reason },
      { where: { userId, sessionId, revokedAt: null } },
    )
    return count > 0
  }

  async revokeAllForUser(userId: string, reason: string): Promise<void> {
    await RefreshToken.update(
      { revokedAt: new Date(), revokeReason: reason },
      { where: { userId, revokedAt: null } },
    )
  }

  listActiveByUser(userId: string): Promise<RefreshToken[]> {
    return RefreshToken.findAll({
      where: { userId, revokedAt: null, expiresAt: { [Op.gt]: new Date() } },
      order: [['lastUsedAt', 'DESC'], ['createdAt', 'DESC']],
    })
  }

  async hasActiveSession(userId: string, sessionId: string): Promise<boolean> {
    return (
      (await RefreshToken.count({
        where: {
          userId,
          sessionId,
          revokedAt: null,
          expiresAt: { [Op.gt]: new Date() },
        },
      })) > 0
    )
  }

  async purgeOlderThan(date: Date): Promise<number> {
    return RefreshToken.destroy({
      where: {
        [Op.or]: [
          { expiresAt: { [Op.lt]: date } },
          { revokedAt: { [Op.lt]: date } },
        ],
      },
    })
  }
}
