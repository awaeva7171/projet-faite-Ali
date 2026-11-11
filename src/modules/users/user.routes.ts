import { Router } from 'express'
import {
  authenticate,
  authorize,
  requireVerifiedEmail,
} from '../../middlewares/authenticate.js'
import { validateBody, validateParams, validateQuery } from '../../middlewares/validate.js'
import { asyncHandler } from '../../shared/async-handler.js'
import { UserController } from './user.controller.js'
import {
  createUserSchema,
  listUsersSchema,
  updateActiveSchema,
  updateRoleSchema,
  userIdParamsSchema,
} from './user.schema.js'

export const userRouter = Router()

userRouter.use(authenticate, requireVerifiedEmail, authorize('admin'))
userRouter.get('/', validateQuery(listUsersSchema), asyncHandler(UserController.index))
userRouter.post('/', validateBody(createUserSchema), asyncHandler(UserController.create))
userRouter.get(
  '/:id',
  validateParams(userIdParamsSchema),
  asyncHandler(UserController.show),
)
userRouter.patch(
  '/:id/role',
  validateParams(userIdParamsSchema),
  validateBody(updateRoleSchema),
  asyncHandler(UserController.updateRole),
)
userRouter.patch(
  '/:id/active',
  validateParams(userIdParamsSchema),
  validateBody(updateActiveSchema),
  asyncHandler(UserController.updateActive),
)
userRouter.post(
  '/:id/revoke-sessions',
  validateParams(userIdParamsSchema),
  asyncHandler(UserController.revokeSessions),
)
userRouter.get(
  '/:id/security-events',
  validateParams(userIdParamsSchema),
  asyncHandler(UserController.securityEvents),
)
