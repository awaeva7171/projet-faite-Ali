import type { Request, Response } from 'express'
import { sendSuccess } from '../../shared/api-response.js'
import type {
  ChangeEmailInput,
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from './auth.schema.js'
import { AuthService } from './auth.service.js'

const service = new AuthService()

function sessionContext(request: Request) {
  return {
    // Les colonnes SQL sont volontairement bornées : ne jamais laisser un
    // en-tête client arbitrairement long provoquer une erreur d'écriture.
    ipAddress: request.ip?.slice(0, 45) ?? null,
    userAgent: request.get('user-agent')?.slice(0, 255) ?? null,
  }
}

export const AuthController = {
  async register(request: Request, response: Response) {
    const result = await service.register(
      request.validated?.body as RegisterInput,
      sessionContext(request),
    )
    return sendSuccess(response, result, 201)
  },

  async login(request: Request, response: Response) {
    const result = await service.login(
      request.validated?.body as LoginInput,
      sessionContext(request),
    )
    return sendSuccess(response, result)
  },

  async refresh(request: Request, response: Response) {
    const { refresh_token } = request.validated?.body as { refresh_token: string }
    return sendSuccess(
      response,
      await service.refresh(refresh_token, sessionContext(request)),
    )
  },

  async logout(request: Request, response: Response) {
    const { refresh_token } = request.validated?.body as { refresh_token: string }
    await service.logout(refresh_token, sessionContext(request))
    return sendSuccess(response, { message: 'Déconnexion effectuée.' })
  },

  async logoutAll(request: Request, response: Response) {
    await service.logoutAll(request.auth!.userId, sessionContext(request))
    return sendSuccess(response, { message: 'Toutes les sessions ont été déconnectées.' })
  },

  async me(request: Request, response: Response) {
    return sendSuccess(response, await service.me(request.auth!.userId))
  },

  async updateProfile(request: Request, response: Response) {
    const { name } = request.validated?.body as { name: string }
    return sendSuccess(response, await service.updateProfile(request.auth!.userId, name))
  },

  async changePassword(request: Request, response: Response) {
    return sendSuccess(
      response,
      await service.changePassword(
        request.auth!.userId,
        request.validated?.body as ChangePasswordInput,
        sessionContext(request),
      ),
    )
  },

  async forgotPassword(request: Request, response: Response) {
    const { email } = request.validated?.body as { email: string }
    return sendSuccess(
      response,
      await service.forgotPassword(email, sessionContext(request)),
      202,
    )
  },

  async resetPassword(request: Request, response: Response) {
    return sendSuccess(
      response,
      await service.resetPassword(
        request.validated?.body as ResetPasswordInput,
        sessionContext(request),
      ),
    )
  },

  async resendVerification(request: Request, response: Response) {
    return sendSuccess(
      response,
      await service.resendVerification(request.auth!.userId, sessionContext(request)),
      202,
    )
  },

  async verifyEmail(request: Request, response: Response) {
    const { token } = request.validated?.body as { token: string }
    return sendSuccess(response, await service.verifyEmail(token, sessionContext(request)))
  },

  async changeEmail(request: Request, response: Response) {
    return sendSuccess(
      response,
      await service.changeEmail(
        request.auth!.userId,
        request.validated?.body as ChangeEmailInput,
        sessionContext(request),
      ),
    )
  },

  async sessions(request: Request, response: Response) {
    return sendSuccess(
      response,
      await service.listSessions(request.auth!.userId, request.auth!.sessionId),
    )
  },

  async revokeSession(request: Request, response: Response) {
    const { sessionId } = request.validated?.params as { sessionId: string }
    return sendSuccess(
      response,
      await service.revokeSession(
        request.auth!.userId,
        sessionId,
        sessionContext(request),
      ),
    )
  },

  async deactivateAccount(request: Request, response: Response) {
    const { current_password } = request.validated?.body as {
      current_password: string
      confirmation: 'DESACTIVER'
    }
    return sendSuccess(
      response,
      await service.deactivateAccount(
        request.auth!.userId,
        current_password,
        sessionContext(request),
      ),
    )
  },
}
