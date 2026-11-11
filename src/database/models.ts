import { AuthAuditEvent } from '../modules/auth/auth-audit-event.model.js'
import { OneTimeToken } from '../modules/auth/one-time-token.model.js'
import { RefreshToken } from '../modules/auth/refresh-token.model.js'
import { User } from '../modules/users/user.model.js'
import { sequelize } from './sequelize.js'

let initialized = false

export function initializeModels(): void {
  if (initialized) return

  User.initModel(sequelize)
  RefreshToken.initModel(sequelize)
  OneTimeToken.initModel(sequelize)
  AuthAuditEvent.initModel(sequelize)

  User.hasMany(RefreshToken, {
    foreignKey: 'userId',
    as: 'refreshTokens',
    onDelete: 'CASCADE',
  })
  RefreshToken.belongsTo(User, { foreignKey: 'userId', as: 'user' })
  RefreshToken.belongsTo(RefreshToken, {
    foreignKey: 'replacedById',
    as: 'replacement',
  })

  User.hasMany(OneTimeToken, {
    foreignKey: 'userId',
    as: 'oneTimeTokens',
    onDelete: 'CASCADE',
  })
  OneTimeToken.belongsTo(User, { foreignKey: 'userId', as: 'user' })

  User.hasMany(AuthAuditEvent, {
    foreignKey: 'userId',
    as: 'authAuditEvents',
    onDelete: 'SET NULL',
  })
  AuthAuditEvent.belongsTo(User, { foreignKey: 'userId', as: 'user' })

  initialized = true
}

export const Models = { User, RefreshToken, OneTimeToken, AuthAuditEvent }
