import { describe, expect, it } from 'vitest'
import {
  loginSchema,
  passwordSchema,
  registerSchema,
  resetPasswordSchema,
} from './auth.schema.js'

describe('validation Auth', () => {
  it('normalise l’email pendant l’inscription', () => {
    const result = registerSchema.parse({
      name: 'Aly Étudiant',
      email: '  ETUDIANT@EXEMPLE.COM ',
      password: 'Secret123',
      password_confirmation: 'Secret123',
    })
    expect(result.email).toBe('etudiant@exemple.com')
  })

  it('refuse deux mots de passe différents', () => {
    const result = registerSchema.safeParse({
      name: 'Aly Étudiant',
      email: 'etudiant@exemple.com',
      password: 'Secret123',
      password_confirmation: 'Different123',
    })
    expect(result.success).toBe(false)
  })

  it('refuse une adresse email mal formée', () => {
    expect(loginSchema.safeParse({ email: 'pas-un-email', password: 'x' }).success).toBe(false)
  })

  it('refuse aussi les identifiants dépassant la limite bcrypt de 72 octets', () => {
    const password72Bytes = `A1${'a'.repeat(70)}`
    expect(
      loginSchema.safeParse({ email: 'etudiant@exemple.com', password: password72Bytes }).success,
    ).toBe(true)
    expect(
      loginSchema.safeParse({
        email: 'etudiant@exemple.com',
        password: `${password72Bytes}suffixe`,
      }).success,
    ).toBe(false)
  })

  it('refuse les mots de passe faibles et ceux dépassant 72 octets', () => {
    expect(passwordSchema.safeParse('seulementminuscules').success).toBe(false)
    expect(passwordSchema.safeParse('É'.repeat(36) + 'Aa1').success).toBe(false)
  })

  it('applique aussi la confirmation au reset du mot de passe', () => {
    expect(
      resetPasswordSchema.safeParse({
        token: 'a'.repeat(43),
        password: 'Nouveau456!',
        password_confirmation: 'Different789!',
      }).success,
    ).toBe(false)
  })
})
