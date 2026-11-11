import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  InMemoryAuditRepository,
  InMemoryRefreshTokenRepository,
  InMemoryUserRepository,
} from '../../tests/fakes/auth-fakes.js'
import { UserService } from './user.service.js'

describe('UserService administrateur', () => {
  let users: InMemoryUserRepository
  let sessions: InMemoryRefreshTokenRepository
  let audit: InMemoryAuditRepository
  let service: UserService

  beforeEach(() => {
    users = new InMemoryUserRepository()
    sessions = new InMemoryRefreshTokenRepository()
    audit = new InMemoryAuditRepository()
    service = new UserService(users, sessions, audit)
  })

  async function createAdmin(email: string) {
    return users.create({
      name: email,
      email,
      passwordHash: 'hash',
      role: 'admin',
      isActive: true,
      emailVerifiedAt: new Date(),
    })
  }

  it('protège le dernier administrateur actif', async () => {
    const admin = await createAdmin('admin@example.com')
    await expect(service.updateRole(admin.id, admin.id, 'learner')).rejects.toMatchObject({
      status: 403,
    })
    await expect(service.updateActive('autre-id', admin.id, false)).rejects.toMatchObject({
      status: 403,
    })
  })

  it('autorise la rétrogradation lorsqu’un autre admin actif existe', async () => {
    const actor = await createAdmin('admin1@example.com')
    const target = await createAdmin('admin2@example.com')
    const result = await service.updateRole(actor.id, target.id, 'teacher')
    expect(result.role).toBe('teacher')
    expect(audit.events.at(-1)?.eventType).toBe('auth.role.changed')
  })

  it('journalise l’administrateur qui crée un compte', async () => {
    const actor = await createAdmin('actor@example.com')

    await service.create(actor.id, {
      name: 'Professeur Awa',
      email: 'awa@example.com',
      password: 'Password123!',
      role: 'teacher',
      is_active: true,
      email_verified: true,
    })

    expect(audit.events.at(-1)).toMatchObject({
      eventType: 'auth.user.admin_created',
      metadata: { actor_id: actor.id, role: 'teacher' },
    })
  })

  it('ne transforme pas une mutation réussie en erreur si l’audit est indisponible', async () => {
    const actor = await createAdmin('admin1@example.com')
    const target = await createAdmin('admin2@example.com')
    vi.spyOn(audit, 'create').mockRejectedValueOnce(new Error('audit unavailable'))

    await expect(service.updateRole(actor.id, target.id, 'teacher')).resolves.toMatchObject({
      role: 'teacher',
    })
  })

  it('empêche un administrateur de désactiver son propre compte', async () => {
    const admin = await createAdmin('admin@example.com')
    await expect(service.updateActive(admin.id, admin.id, false)).rejects.toMatchObject({
      status: 403,
    })
  })

  it('révoque les sessions d’un utilisateur et invalide ses access tokens', async () => {
    const actor = await createAdmin('admin@example.com')
    const target = await users.create({
      name: 'Awa',
      email: 'awa@example.com',
      passwordHash: 'hash',
      role: 'learner',
    })
    const beforeVersion = target.authVersion

    await service.revokeSessions(actor.id, target.id)

    expect((await users.findById(target.id))?.authVersion).toBe(beforeVersion + 1)
    expect(audit.events.at(-1)?.eventType).toBe('auth.sessions.admin_revoked')
  })
})
