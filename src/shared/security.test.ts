import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './password.js'
import { hashToken, signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from './token.js'

describe('primitives de sécurité', () => {
  it('hache et vérifie un mot de passe', async () => {
    const hash = await hashPassword('Secret123')
    expect(hash).not.toBe('Secret123')
    await expect(verifyPassword('Secret123', hash)).resolves.toBe(true)
    await expect(verifyPassword('Erreur123', hash)).resolves.toBe(false)
  })

  it('signe des jetons typés', () => {
    const sessionId = '2fe40c63-ce86-48b3-baf5-af39002e36bd'
    const access = signAccessToken(
      {
        id: '9aa7a45d-7d58-4263-bcb5-0b40f24aaabc',
        email: 'prof@test.sn',
        role: 'teacher',
        authVersion: 1,
      },
      sessionId,
    )
    const refresh = signRefreshToken(
      '9aa7a45d-7d58-4263-bcb5-0b40f24aaabc',
      sessionId,
      1,
    )
    expect(verifyAccessToken(access)).toMatchObject({
      type: 'access',
      role: 'teacher',
      ver: 1,
      sid: sessionId,
    })
    expect(verifyRefreshToken(refresh.token)).toMatchObject({
      type: 'refresh',
      jti: refresh.jti,
      sid: sessionId,
      ver: 1,
    })
    expect(hashToken(refresh.token)).toHaveLength(64)
  })
})
