import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from 'sequelize'

export class RefreshToken extends Model<
  InferAttributes<RefreshToken>,
  InferCreationAttributes<RefreshToken>
> {
  declare id: CreationOptional<string>
  declare userId: string
  declare sessionId: string
  declare tokenHash: string
  declare jwtId: string
  declare expiresAt: Date
  declare revokedAt: CreationOptional<Date | null>
  declare revokeReason: CreationOptional<string | null>
  declare replacedById: CreationOptional<string | null>
  declare reuseDetectedAt: CreationOptional<Date | null>
  declare userAgent: CreationOptional<string | null>
  declare ipAddress: CreationOptional<string | null>
  declare lastUsedAt: CreationOptional<Date | null>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  static initModel(sequelize: Sequelize): typeof RefreshToken {
    RefreshToken.init(
      {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
        sessionId: { type: DataTypes.UUID, allowNull: false, field: 'session_id' },
        tokenHash: { type: DataTypes.CHAR(64), allowNull: false, unique: 'rt_token_hash_uq', field: 'token_hash' },
        jwtId: { type: DataTypes.UUID, allowNull: false, unique: 'rt_jwt_id_uq', field: 'jwt_id' },
        expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
        revokedAt: { type: DataTypes.DATE, allowNull: true, field: 'revoked_at' },
        revokeReason: { type: DataTypes.STRING(40), allowNull: true, field: 'revoke_reason' },
        replacedById: { type: DataTypes.UUID, allowNull: true, field: 'replaced_by_id' },
        reuseDetectedAt: { type: DataTypes.DATE, allowNull: true, field: 'reuse_detected_at' },
        userAgent: { type: DataTypes.STRING(255), allowNull: true, field: 'user_agent' },
        ipAddress: { type: DataTypes.STRING(45), allowNull: true, field: 'ip_address' },
        lastUsedAt: { type: DataTypes.DATE, allowNull: true, field: 'last_used_at' },
        createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
        updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
      },
      { sequelize, tableName: 'refresh_tokens', modelName: 'RefreshToken', underscored: true },
    )
    return RefreshToken
  }

  toSessionJSON(currentSessionId?: string) {
    return {
      session_id: this.sessionId,
      ip_address: this.ipAddress,
      user_agent: this.userAgent,
      last_used_at: this.lastUsedAt ?? this.createdAt,
      expires_at: this.expiresAt,
      is_current: this.sessionId === currentSessionId,
    }
  }
}
