import { Router } from 'express'
import {
  authenticate,
  authorize,
  requireVerifiedEmail,
} from '../../middlewares/authenticate.js'
import { sendSuccess } from '../../shared/api-response.js'

export const demoRouter = Router()

demoRouter.get('/authenticated', authenticate, (request, response) =>
  sendSuccess(response, {
    message: 'Route accessible à tout utilisateur connecté.',
    auth: request.auth,
  }),
)

demoRouter.get(
  '/verified',
  authenticate,
  requireVerifiedEmail,
  (_request, response) =>
    sendSuccess(response, { message: 'Adresse vérifiée : accès accordé.' }),
)

demoRouter.get(
  '/admin',
  authenticate,
  authorize('admin'),
  (_request, response) =>
    sendSuccess(response, { message: 'Route réservée aux administrateurs.' }),
)

demoRouter.get(
  '/teaching-team',
  authenticate,
  authorize('admin', 'teacher'),
  (_request, response) =>
    sendSuccess(response, { message: 'Route accessible aux professeurs et administrateurs.' }),
)
