import 'dotenv/config'
import { z } from 'zod'

const booleanString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true')

const optionalString = z.string().transform((value) => value || undefined).optional()

const trustProxy = z
  .union([z.literal('false'), z.string().regex(/^\d+$/)])
  .default('false')
  .transform((value) => {
    if (value === 'false') return false
    return Number(value)
  })

const DEVELOPMENT_ACCESS_SECRET = 'development-access-secret-change-me-123456789'
const DEVELOPMENT_REFRESH_SECRET = 'development-refresh-secret-change-me-12345678'
const DOCUMENTED_ACCESS_PLACEHOLDER = 'change-this-access-secret-with-at-least-32-characters'
const DOCUMENTED_REFRESH_PLACEHOLDER = 'change-this-refresh-secret-with-at-least-32-characters'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_URL: z.url().default('http://localhost:3000'),
  FRONTEND_URL: z.url().default('http://localhost:5173'),
  TRUST_PROXY: trustProxy,
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_NAME: z.string().min(1).default('cours_alygne_auth'),
  DB_TEST_NAME: z.string().min(1).default('cours_alygne_auth_test'),
  DB_USER: z.string().min(1).default('root'),
  DB_PASSWORD: z.string().default(''),
  DB_LOGGING: booleanString,
  DB_SSL: booleanString,
  JWT_ACCESS_SECRET: z.string().min(32).default(DEVELOPMENT_ACCESS_SECRET),
  JWT_REFRESH_SECRET: z.string().min(32).default(DEVELOPMENT_REFRESH_SECRET),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  EMAIL_VERIFICATION_TTL_MINUTES: z.coerce.number().int().positive().default(1440),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().positive().default(15),
  MAIL_DRIVER: z.enum(['log', 'smtp']).default('log'),
  MAIL_FROM: z.string().default('Cours-Alygne <no-reply@cours-alygne.test>'),
  MAIL_HOST: z.string().default('127.0.0.1'),
  MAIL_PORT: z.coerce.number().int().positive().default(1025),
  MAIL_SECURE: booleanString,
  MAIL_USER: optionalString,
  MAIL_PASSWORD: optionalString,
  AUTH_EXPOSE_DEBUG_TOKENS: booleanString,
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(600),
})

const parsed = envSchema.safeParse(process.env)
if (!parsed.success) {
  console.error('Configuration invalide :', z.treeifyError(parsed.error))
  throw new Error('Les variables d’environnement sont invalides.')
}

export const env = parsed.data

export function assertSafeProductionConfiguration(): void {
  if (env.NODE_ENV !== 'production') return
  const unsafeSecrets = new Set([
    DEVELOPMENT_ACCESS_SECRET,
    DEVELOPMENT_REFRESH_SECRET,
    DOCUMENTED_ACCESS_PLACEHOLDER,
    DOCUMENTED_REFRESH_PLACEHOLDER,
  ])
  if (unsafeSecrets.has(env.JWT_ACCESS_SECRET) || unsafeSecrets.has(env.JWT_REFRESH_SECRET)) {
    throw new Error('Les secrets JWT par défaut ou d’exemple sont interdits en production.')
  }
  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    throw new Error('Les secrets JWT d’accès et de renouvellement doivent être différents.')
  }
  if (env.AUTH_EXPOSE_DEBUG_TOKENS) {
    throw new Error('AUTH_EXPOSE_DEBUG_TOKENS doit être false en production.')
  }
  if (env.MAIL_DRIVER !== 'smtp') {
    throw new Error('MAIL_DRIVER=smtp est obligatoire en production.')
  }
}
