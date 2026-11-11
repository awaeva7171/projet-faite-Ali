import { Router } from 'express'
import { authenticate } from '../../middlewares/authenticate.js'
import {
  createRateLimiter,
  identityRateLimitKey,
} from '../../middlewares/rate-limit.js'
import { validateBody, validateParams } from '../../middlewares/validate.js'
import { asyncHandler } from '../../shared/async-handler.js'
import {
  changeEmailSchema,
  changePasswordSchema,
  deactivateAccountSchema,
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  sessionParamsSchema,
  updateProfileSchema,
  verifyEmailSchema,
} from './auth.schema.js'
import { AuthController } from './auth.controller.js'

export const authRouter = Router()

const registerLimiter = createRateLimiter({
  windowMs: 15 * 60_000,
  // Une classe entière derrière le même NAT peut créer son compte.
  limit: 60,
})

const loginLimiter = createRateLimiter({
  windowMs: 15 * 60_000,
  limit: 10,
  keyGenerator: identityRateLimitKey,
  // Une connexion réussie ne pénalise pas les apprenants d'une salle partagée.
  skipSuccessfulRequests: true,
})

const recoveryLimiter = createRateLimiter({
  windowMs: 15 * 60_000,
  limit: 5,
  keyGenerator: identityRateLimitKey,
})

authRouter.post(
  '/register',
  registerLimiter,
  validateBody(registerSchema),
  asyncHandler(AuthController.register),
)
authRouter.post(
  '/login',
  loginLimiter,
  validateBody(loginSchema),
  asyncHandler(AuthController.login),
)
authRouter.post('/refresh', validateBody(refreshSchema), asyncHandler(AuthController.refresh))
authRouter.post('/logout', validateBody(logoutSchema), asyncHandler(AuthController.logout))
authRouter.post(
  '/forgot-password',
  recoveryLimiter,
  validateBody(forgotPasswordSchema),
  asyncHandler(AuthController.forgotPassword),
)
authRouter.post(
  '/reset-password',
  recoveryLimiter,
  validateBody(resetPasswordSchema),
  asyncHandler(AuthController.resetPassword),
)
authRouter.post(
  '/email/verify',
  recoveryLimiter,
  validateBody(verifyEmailSchema),
  asyncHandler(AuthController.verifyEmail),
)

authRouter.use(authenticate)
authRouter.get('/me', asyncHandler(AuthController.me))
authRouter.patch(
  '/profile',
  validateBody(updateProfileSchema),
  asyncHandler(AuthController.updateProfile),
)
authRouter.patch(
  '/password',
  validateBody(changePasswordSchema),
  asyncHandler(AuthController.changePassword),
)
authRouter.post(
  '/email/change',
  validateBody(changeEmailSchema),
  asyncHandler(AuthController.changeEmail),
)
authRouter.post(
  '/email/verification-notification',
  recoveryLimiter,
  asyncHandler(AuthController.resendVerification),
)
authRouter.post('/logout-all', asyncHandler(AuthController.logoutAll))
authRouter.get('/sessions', asyncHandler(AuthController.sessions))
authRouter.delete(
  '/sessions/:sessionId',
  validateParams(sessionParamsSchema),
  asyncHandler(AuthController.revokeSession),
)
authRouter.delete(
  '/account',
  validateBody(deactivateAccountSchema),
  asyncHandler(AuthController.deactivateAccount),
)
