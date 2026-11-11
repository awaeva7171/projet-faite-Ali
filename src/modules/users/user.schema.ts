import { z } from 'zod'
import { passwordSchema } from '../auth/auth.schema.js'
import { USER_ROLES } from './user.model.js'

export const userIdParamsSchema = z.object({ id: z.string().uuid() })

export const listUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(USER_ROLES).optional(),
  search: z.string().trim().max(100).optional(),
  is_active: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  is_verified: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
})

export const createUserSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email().max(190),
    password: passwordSchema,
    password_confirmation: z.string(),
    role: z.enum(USER_ROLES),
    is_active: z.boolean().default(true),
    email_verified: z.boolean().default(false),
  })
  .superRefine((data, context) => {
    if (data.password !== data.password_confirmation) {
      context.addIssue({
        code: 'custom',
        path: ['password_confirmation'],
        message: 'Les deux mots de passe ne correspondent pas.',
      })
    }
  })

export const updateRoleSchema = z.object({ role: z.enum(USER_ROLES) })
export const updateActiveSchema = z.object({ is_active: z.boolean() })
