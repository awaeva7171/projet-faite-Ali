'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      name: { type: Sequelize.STRING(120), allowNull: false },
      email: { type: Sequelize.STRING(190), allowNull: false },
      password_hash: { type: Sequelize.STRING(255), allowNull: false },
      role: {
        type: Sequelize.ENUM('admin', 'teacher', 'learner'),
        allowNull: false,
        defaultValue: 'learner',
      },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      email_verified_at: { type: Sequelize.DATE, allowNull: true },
      auth_version: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
      failed_login_attempts: { type: Sequelize.SMALLINT.UNSIGNED, allowNull: false, defaultValue: 0 },
      locked_until: { type: Sequelize.DATE, allowNull: true },
      last_login_at: { type: Sequelize.DATE, allowNull: true },
      password_changed_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    })

    await queryInterface.addIndex('users', ['email'], { unique: true, name: 'users_email_uq' })
    await queryInterface.addIndex('users', ['role', 'is_active'], { name: 'users_role_active_idx' })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('users')
  },
}
