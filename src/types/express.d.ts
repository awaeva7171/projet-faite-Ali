import type { UserRole } from '../modules/users/user.model.js'

declare global {
  namespace Express {
    interface Request {
      requestId: string
      validated?: {
        body?: unknown
        params?: unknown
        query?: unknown
      }
      auth?: {
        userId: string
        email: string
        role: UserRole
        sessionId: string
        emailVerifiedAt: Date | null
      }
    }
  }
}

export {}
