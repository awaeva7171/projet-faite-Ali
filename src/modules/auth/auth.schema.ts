import { z } from 'zod'

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Adresse email invalide.')
  .max(190)

export const passwordSchema = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
  .max(128)
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, {
    message: 'Le mot de passe ne doit pas dépasser 72 octets.',
  })
  .regex(/[A-Z]/, 'Ajoutez une majuscule.')
  .regex(/[a-z]/, 'Ajoutez une minuscule.')
  .regex(/[0-9]/, 'Ajoutez un chiffre.')

const passwordCredentialSchema = z
  .string()
  .min(1)
  .max(128)
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, {
    message: 'Le mot de passe ne doit pas dépasser 72 octets.',
  })

function passwordsMatch(
  data: { password: string; password_confirmation: string },
  context: z.RefinementCtx,
) {
  if (data.password !== data.password_confirmation) {
    context.addIssue({
      code: 'custom',
      path: ['password_confirmation'],
      message: 'Les deux mots de passe ne correspondent pas.',
    })
  }
}

export const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: emailSchema,
    password: passwordSchema,
    password_confirmation: z.string(),
  })
  .superRefine(passwordsMatch)

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordCredentialSchema,
})

export const refreshSchema = z.object({ refresh_token: z.string().min(20).max(4096) })
export const logoutSchema = refreshSchema
export const forgotPasswordSchema = z.object({ email: emailSchema })

export const resetPasswordSchema = z
  .object({
    token: z.string().min(32).max(256),
    password: passwordSchema,
    password_confirmation: z.string(),
  })
  .superRefine(passwordsMatch)

export const verifyEmailSchema = z.object({ token: z.string().min(32).max(256) })
export const updateProfileSchema = z.object({ name: z.string().trim().min(2).max(120) })

export const changePasswordSchema = z
  .object({
    current_password: passwordCredentialSchema,
    password: passwordSchema,
    password_confirmation: z.string(),
  })
  .superRefine(passwordsMatch)

export const changeEmailSchema = z.object({
  email: emailSchema,
  current_password: passwordCredentialSchema,
})

export const deactivateAccountSchema = z.object({
  current_password: passwordCredentialSchema,
  confirmation: z.literal('DESACTIVER'),
})

export const sessionParamsSchema = z.object({ sessionId: z.string().uuid() })

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>
