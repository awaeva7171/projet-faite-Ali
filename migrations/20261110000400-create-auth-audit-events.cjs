'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('auth_audit_events', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      event_type: { type: Sequelize.STRING(64), allowNull: false },
      status: {
        type: Sequelize.ENUM('success', 'failure'),
        allowNull: false,
        defaultValue: 'success',
      },
      email_hash: { type: Sequelize.CHAR(64), allowNull: true },
      ip_address: { type: Sequelize.STRING(45), allowNull: true },
      user_agent: { type: Sequelize.STRING(255), allowNull: true },
      metadata: { type: Sequelize.JSON, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    })

    await queryInterface.addIndex('auth_audit_events', ['user_id', 'created_at'], {
      name: 'aae_user_date_idx',
    })
    await queryInterface.addIndex('auth_audit_events', ['event_type', 'created_at'], {
      name: 'aae_type_date_idx',
    })
    await queryInterface.addIndex('auth_audit_events', ['created_at'], { name: 'aae_created_idx' })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('auth_audit_events')
  },
}
