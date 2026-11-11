import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from 'sequelize'

export const TOKEN_PURPOSES = ['verify_email', 'reset_password'] as const
export type TokenPurpose = (typeof TOKEN_PURPOSES)[number]

export class OneTimeToken extends Model<
  InferAttributes<OneTimeToken>,
  InferCreationAttributes<OneTimeToken>
> {
  declare id: CreationOptional<string>
  declare userId: string
  declare purpose: TokenPurpose
  declare tokenHash: string
  declare contextHash: CreationOptional<string | null>
  declare expiresAt: Date
  declare consumedAt: CreationOptional<Date | null>
  declare requestedIp: CreationOptional<string | null>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  static initModel(sequelize: Sequelize): typeof OneTimeToken {
    OneTimeToken.init(
      {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
        purpose: { type: DataTypes.ENUM(...TOKEN_PURPOSES), allowNull: false },
        tokenHash: { type: DataTypes.CHAR(64), allowNull: false, unique: 'ott_token_hash_uq', field: 'token_hash' },
        contextHash: { type: DataTypes.CHAR(64), allowNull: true, field: 'context_hash' },
        expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
        consumedAt: { type: DataTypes.DATE, allowNull: true, field: 'consumed_at' },
        requestedIp: { type: DataTypes.STRING(45), allowNull: true, field: 'requested_ip' },
        createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
        updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
      },
      { sequelize, tableName: 'one_time_tokens', modelName: 'OneTimeToken', underscored: true },
    )
    return OneTimeToken
  }
}
