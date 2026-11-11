'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('one_time_tokens', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      purpose: {
        type: Sequelize.ENUM('verify_email', 'reset_password'),
        allowNull: false,
      },
      token_hash: { type: Sequelize.CHAR(64), allowNull: false },
      context_hash: { type: Sequelize.CHAR(64), allowNull: true },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      consumed_at: { type: Sequelize.DATE, allowNull: true },
      requested_ip: { type: Sequelize.STRING(45), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    })

    await queryInterface.addIndex('one_time_tokens', ['token_hash'], {
      unique: true,
      name: 'ott_token_hash_uq',
    })
    await queryInterface.addIndex('one_time_tokens', ['user_id', 'purpose', 'consumed_at'], {
      name: 'ott_user_purpose_idx',
    })
    await queryInterface.addIndex('one_time_tokens', ['expires_at'], { name: 'ott_expires_idx' })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('one_time_tokens')
  },
}
