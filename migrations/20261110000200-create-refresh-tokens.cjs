'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('refresh_tokens', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      session_id: { type: Sequelize.UUID, allowNull: false },
      token_hash: { type: Sequelize.CHAR(64), allowNull: false },
      jwt_id: { type: Sequelize.UUID, allowNull: false },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      revoked_at: { type: Sequelize.DATE, allowNull: true },
      revoke_reason: { type: Sequelize.STRING(40), allowNull: true },
      replaced_by_id: { type: Sequelize.UUID, allowNull: true },
      reuse_detected_at: { type: Sequelize.DATE, allowNull: true },
      user_agent: { type: Sequelize.STRING(255), allowNull: true },
      ip_address: { type: Sequelize.STRING(45), allowNull: true },
      last_used_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    })

    await queryInterface.addConstraint('refresh_tokens', {
      fields: ['replaced_by_id'],
      type: 'foreign key',
      name: 'rt_replacement_fk',
      references: { table: 'refresh_tokens', field: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    })
    await queryInterface.addIndex('refresh_tokens', ['token_hash'], { unique: true, name: 'rt_token_hash_uq' })
    await queryInterface.addIndex('refresh_tokens', ['jwt_id'], { unique: true, name: 'rt_jwt_id_uq' })
    await queryInterface.addIndex('refresh_tokens', ['user_id', 'revoked_at', 'expires_at'], {
      name: 'rt_user_state_idx',
    })
    await queryInterface.addIndex('refresh_tokens', ['session_id', 'revoked_at'], {
      name: 'rt_session_state_idx',
    })
    await queryInterface.addIndex('refresh_tokens', ['expires_at'], { name: 'rt_expires_idx' })
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('refresh_tokens', 'rt_replacement_fk')
    await queryInterface.dropTable('refresh_tokens')
  },
}
