import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from 'sequelize'

export const USER_ROLES = ['admin', 'teacher', 'learner'] as const
export type UserRole = (typeof USER_ROLES)[number]

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<string>
  declare name: string
  declare email: string
  declare passwordHash: string
  declare role: CreationOptional<UserRole>
  declare isActive: CreationOptional<boolean>
  declare emailVerifiedAt: CreationOptional<Date | null>
  declare authVersion: CreationOptional<number>
  declare failedLoginAttempts: CreationOptional<number>
  declare lockedUntil: CreationOptional<Date | null>
  declare lastLoginAt: CreationOptional<Date | null>
  declare passwordChangedAt: CreationOptional<Date | null>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  static initModel(sequelize: Sequelize): typeof User {
    User.init(
      {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        name: { type: DataTypes.STRING(120), allowNull: false },
        email: { type: DataTypes.STRING(190), allowNull: false, unique: 'users_email_uq' },
        passwordHash: { type: DataTypes.STRING(255), allowNull: false, field: 'password_hash' },
        role: { type: DataTypes.ENUM(...USER_ROLES), allowNull: false, defaultValue: 'learner' },
        isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
        emailVerifiedAt: { type: DataTypes.DATE, allowNull: true, field: 'email_verified_at' },
        authVersion: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 1,
          field: 'auth_version',
        },
        failedLoginAttempts: {
          type: DataTypes.SMALLINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          field: 'failed_login_attempts',
        },
        lockedUntil: { type: DataTypes.DATE, allowNull: true, field: 'locked_until' },
        lastLoginAt: { type: DataTypes.DATE, allowNull: true, field: 'last_login_at' },
        passwordChangedAt: { type: DataTypes.DATE, allowNull: true, field: 'password_changed_at' },
        createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
        updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
      },
      { sequelize, tableName: 'users', modelName: 'User', underscored: true },
    )
    return User
  }

  toSafeJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      role: this.role,
      is_active: this.isActive,
      email_verified: this.emailVerifiedAt !== null,
      email_verified_at: this.emailVerifiedAt,
      last_login_at: this.lastLoginAt,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
    }
  }
}
