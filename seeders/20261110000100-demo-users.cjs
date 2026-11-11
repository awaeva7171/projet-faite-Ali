'use strict'

const bcrypt = require('bcryptjs')
const { randomUUID } = require('node:crypto')

module.exports = {
  async up(queryInterface) {
    const now = new Date()
    const passwordHash = await bcrypt.hash('Password123!', 12)
    await queryInterface.bulkInsert('users', [
      {
        id: randomUUID(),
        name: 'Administrateur Démo',
        email: 'admin@cours-alygne.test',
        password_hash: passwordHash,
        role: 'admin',
        is_active: true,
        email_verified_at: now,
        auth_version: 1,
        failed_login_attempts: 0,
        locked_until: null,
        last_login_at: null,
        password_changed_at: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: randomUUID(),
        name: 'Professeur Démo',
        email: 'teacher@cours-alygne.test',
        password_hash: passwordHash,
        role: 'teacher',
        is_active: true,
        email_verified_at: now,
        auth_version: 1,
        failed_login_attempts: 0,
        locked_until: null,
        last_login_at: null,
        password_changed_at: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: randomUUID(),
        name: 'Apprenant Démo',
        email: 'learner@cours-alygne.test',
        password_hash: passwordHash,
        role: 'learner',
        is_active: true,
        email_verified_at: now,
        auth_version: 1,
        failed_login_attempts: 0,
        locked_until: null,
        last_login_at: null,
        password_changed_at: null,
        created_at: now,
        updated_at: now,
      },
    ])
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('users', {
      email: [
        'admin@cours-alygne.test',
        'teacher@cours-alygne.test',
        'learner@cours-alygne.test',
      ],
    })
  },
}
