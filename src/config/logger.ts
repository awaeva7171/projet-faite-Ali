import pino from 'pino'
import { env } from './env.js'

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : 'info',
  base: { service: 'cours-alygne-auth-api' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.body.password',
      'req.body.password_confirmation',
      'req.body.current_password',
      'req.body.refresh_token',
      'req.body.token',
      'res.headers["set-cookie"]',
    ],
    censor: '[REDACTED]',
  },
})
