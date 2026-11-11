import { Op } from 'sequelize'
import { OneTimeToken, type TokenPurpose } from './one-time-token.model.js'

export interface IOneTimeTokenRepository {
  issue(data: {
    userId: string
    purpose: TokenPurpose
    tokenHash: string
    contextHash?: string | null
    expiresAt: Date
    requestedIp?: string | null
  }): Promise<OneTimeToken>
  findByHash(tokenHash: string, purpose: TokenPurpose): Promise<OneTimeToken | null>
  claim(id: string): Promise<boolean>
  invalidateForUser(userId: string, purpose?: TokenPurpose): Promise<number>
  purgeOlderThan(date: Date): Promise<number>
}

export class OneTimeTokenRepository implements IOneTimeTokenRepository {
  async issue(data: {
    userId: string
    purpose: TokenPurpose
    tokenHash: string
    contextHash?: string | null
    expiresAt: Date
    requestedIp?: string | null
  }): Promise<OneTimeToken> {
    await OneTimeToken.update(
      { consumedAt: new Date() },
      {
        where: {
          userId: data.userId,
          purpose: data.purpose,
          consumedAt: null,
        },
      },
    )
    return OneTimeToken.create(data)
  }

  findByHash(tokenHash: string, purpose: TokenPurpose): Promise<OneTimeToken | null> {
    return OneTimeToken.findOne({ where: { tokenHash, purpose } })
  }

  async claim(id: string): Promise<boolean> {
    const [count] = await OneTimeToken.update(
      { consumedAt: new Date() },
      {
        where: {
          id,
          consumedAt: null,
          expiresAt: { [Op.gt]: new Date() },
        },
      },
    )
    return count === 1
  }

  async invalidateForUser(userId: string, purpose?: TokenPurpose): Promise<number> {
    const [count] = await OneTimeToken.update(
      { consumedAt: new Date() },
      {
        where: {
          userId,
          ...(purpose ? { purpose } : {}),
          consumedAt: null,
        },
      },
    )
    return count
  }

  async purgeOlderThan(date: Date): Promise<number> {
    return OneTimeToken.destroy({
      where: {
        [Op.or]: [
          { expiresAt: { [Op.lt]: date } },
          { consumedAt: { [Op.lt]: date } },
        ],
      },
    })
  }
}
