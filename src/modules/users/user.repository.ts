import { Op, type WhereOptions } from 'sequelize'
import { sequelize } from '../../database/sequelize.js'
import type { UserRole } from './user.model.js'
import { User } from './user.model.js'

export interface CreateUserRecord {
  name: string
  email: string
  passwordHash: string
  role?: UserRole
  isActive?: boolean
  emailVerifiedAt?: Date | null
}

export interface ListUsersInput {
  page: number
  perPage: number
  role?: UserRole
  search?: string
  isActive?: boolean
  isVerified?: boolean
}

export type GuardedUserUpdate =
  | { status: 'updated'; user: User }
  | { status: 'not_found' }
  | { status: 'last_active_admin' }

export interface IUserRepository {
  findById(id: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  create(data: CreateUserRecord): Promise<User>
  updateName(id: string, name: string): Promise<User | null>
  changeEmail(id: string, email: string): Promise<User | null>
  markEmailVerified(id: string, at: Date): Promise<User | null>
  recordLoginFailure(id: string, attempts: number, lockedUntil: Date | null): Promise<void>
  recordLoginSuccess(id: string, at: Date): Promise<User | null>
  updatePassword(id: string, passwordHash: string, at: Date): Promise<User | null>
  bumpAuthVersion(id: string): Promise<User | null>
  list(input: ListUsersInput): Promise<{ rows: User[]; count: number }>
  countActiveAdmins(): Promise<number>
  updateRole(id: string, role: UserRole): Promise<User | null>
  updateActive(id: string, isActive: boolean): Promise<User | null>
  updateRoleGuarded(id: string, role: UserRole): Promise<GuardedUserUpdate>
  updateActiveGuarded(id: string, isActive: boolean): Promise<GuardedUserUpdate>
}

export class UserRepository implements IUserRepository {
  findById(id: string): Promise<User | null> {
    return User.findByPk(id)
  }

  findByEmail(email: string): Promise<User | null> {
    return User.findOne({ where: { email: email.trim().toLowerCase() } })
  }

  create(data: CreateUserRecord): Promise<User> {
    return User.create({ ...data, email: data.email.trim().toLowerCase() })
  }

  async updateName(id: string, name: string): Promise<User | null> {
    const user = await this.findById(id)
    return user ? user.update({ name }) : null
  }

  async changeEmail(id: string, email: string): Promise<User | null> {
    const user = await this.findById(id)
    if (!user) return null
    return user.update({
      email: email.trim().toLowerCase(),
      emailVerifiedAt: null,
      authVersion: user.authVersion + 1,
    })
  }

  async markEmailVerified(id: string, at: Date): Promise<User | null> {
    const user = await this.findById(id)
    return user ? user.update({ emailVerifiedAt: at }) : null
  }

  async recordLoginFailure(id: string, attempts: number, lockedUntil: Date | null): Promise<void> {
    await User.update(
      { failedLoginAttempts: attempts, lockedUntil },
      { where: { id } },
    )
  }

  async recordLoginSuccess(id: string, at: Date): Promise<User | null> {
    const user = await this.findById(id)
    return user
      ? user.update({ failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: at })
      : null
  }

  async updatePassword(id: string, passwordHash: string, at: Date): Promise<User | null> {
    const user = await this.findById(id)
    if (!user) return null
    return user.update({
      passwordHash,
      passwordChangedAt: at,
      failedLoginAttempts: 0,
      lockedUntil: null,
      authVersion: user.authVersion + 1,
    })
  }

  async bumpAuthVersion(id: string): Promise<User | null> {
    const user = await this.findById(id)
    return user ? user.update({ authVersion: user.authVersion + 1 }) : null
  }

  async list(input: ListUsersInput) {
    const where: WhereOptions = {
      ...(input.role ? { role: input.role } : {}),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      ...(input.isVerified === undefined
        ? {}
        : {
            emailVerifiedAt: input.isVerified ? { [Op.ne]: null } : { [Op.is]: null },
          }),
      ...(input.search
        ? {
            [Op.or]: [
              { name: { [Op.like]: `%${input.search}%` } },
              { email: { [Op.like]: `%${input.search}%` } },
            ],
          }
        : {}),
    }

    return User.findAndCountAll({
      where,
      limit: input.perPage,
      offset: (input.page - 1) * input.perPage,
      order: [['createdAt', 'DESC']],
    })
  }

  countActiveAdmins(): Promise<number> {
    return User.count({ where: { role: 'admin', isActive: true } })
  }

  async updateRole(id: string, role: UserRole): Promise<User | null> {
    const user = await this.findById(id)
    return user ? user.update({ role, authVersion: user.authVersion + 1 }) : null
  }

  async updateActive(id: string, isActive: boolean): Promise<User | null> {
    const user = await this.findById(id)
    return user
      ? user.update({ isActive, authVersion: user.authVersion + 1 })
      : null
  }

  /**
   * Serialize les mutations d'administrateurs actifs. Le verrou porte sur la
   * liste entière, dans un ordre déterministe, afin que deux rétrogradations
   * simultanées ne puissent pas toutes deux observer « deux administrateurs ».
   */
  async updateRoleGuarded(id: string, role: UserRole): Promise<GuardedUserUpdate> {
    return sequelize.transaction(async (transaction) => {
      const activeAdmins = await User.findAll({
        where: { role: 'admin', isActive: true },
        attributes: ['id'],
        order: [['id', 'ASC']],
        transaction,
        lock: transaction.LOCK.UPDATE,
      })
      const user = await User.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      })
      if (!user) return { status: 'not_found' }
      if (
        user.role === 'admin' &&
        user.isActive &&
        role !== 'admin' &&
        activeAdmins.length <= 1
      ) {
        return { status: 'last_active_admin' }
      }
      await user.update(
        { role, authVersion: user.authVersion + 1 },
        { transaction },
      )
      return { status: 'updated', user }
    })
  }

  async updateActiveGuarded(id: string, isActive: boolean): Promise<GuardedUserUpdate> {
    return sequelize.transaction(async (transaction) => {
      const activeAdmins = await User.findAll({
        where: { role: 'admin', isActive: true },
        attributes: ['id'],
        order: [['id', 'ASC']],
        transaction,
        lock: transaction.LOCK.UPDATE,
      })
      const user = await User.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      })
      if (!user) return { status: 'not_found' }
      if (
        user.role === 'admin' &&
        user.isActive &&
        !isActive &&
        activeAdmins.length <= 1
      ) {
        return { status: 'last_active_admin' }
      }
      await user.update(
        { isActive, authVersion: user.authVersion + 1 },
        { transaction },
      )
      return { status: 'updated', user }
    })
  }
}
