import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from 'sequelize'

export class AuthAuditEvent extends Model<
  InferAttributes<AuthAuditEvent>,
  InferCreationAttributes<AuthAuditEvent>
> {
  declare id: CreationOptional<string>
  declare userId: CreationOptional<string | null>
  declare eventType: string
  declare status: CreationOptional<'success' | 'failure'>
  declare emailHash: CreationOptional<string | null>
  declare ipAddress: CreationOptional<string | null>
  declare userAgent: CreationOptional<string | null>
  declare metadata: CreationOptional<Record<string, unknown> | null>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  static initModel(sequelize: Sequelize): typeof AuthAuditEvent {
    AuthAuditEvent.init(
      {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        userId: { type: DataTypes.UUID, allowNull: true, field: 'user_id' },
        eventType: { type: DataTypes.STRING(64), allowNull: false, field: 'event_type' },
        status: { type: DataTypes.ENUM('success', 'failure'), allowNull: false, defaultValue: 'success' },
        emailHash: { type: DataTypes.CHAR(64), allowNull: true, field: 'email_hash' },
        ipAddress: { type: DataTypes.STRING(45), allowNull: true, field: 'ip_address' },
        userAgent: { type: DataTypes.STRING(255), allowNull: true, field: 'user_agent' },
        metadata: { type: DataTypes.JSON, allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
        updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
      },
      { sequelize, tableName: 'auth_audit_events', modelName: 'AuthAuditEvent', underscored: true },
    )
    return AuthAuditEvent
  }
}
