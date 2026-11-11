import type { Request, Response } from 'express'
import { sendSuccess } from '../../shared/api-response.js'
import type { UserRole } from './user.model.js'
import { UserService } from './user.service.js'

const service = new UserService()

export const UserController = {
  async create(request: Request, response: Response) {
    const input = request.validated?.body as {
      name: string
      email: string
      password: string
      password_confirmation: string
      role: UserRole
      is_active: boolean
      email_verified: boolean
    }
    return sendSuccess(
      response,
      await service.create(request.auth!.userId, input),
      201,
    )
  },

  async index(request: Request, response: Response) {
    const query = request.validated?.query as {
      page: number
      per_page: number
      role?: UserRole
      search?: string
      is_active?: boolean
      is_verified?: boolean
    }
    const result = await service.list({
      page: query.page,
      perPage: query.per_page,
      ...(query.role ? { role: query.role } : {}),
      ...(query.search ? { search: query.search } : {}),
      ...(query.is_active === undefined ? {} : { isActive: query.is_active }),
      ...(query.is_verified === undefined ? {} : { isVerified: query.is_verified }),
    })
    return sendSuccess(response, result.users, 200, result.pagination)
  },

  async show(request: Request, response: Response) {
    const { id } = request.validated?.params as { id: string }
    return sendSuccess(response, await service.show(id))
  },

  async updateRole(request: Request, response: Response) {
    const { id } = request.validated?.params as { id: string }
    const { role } = request.validated?.body as { role: UserRole }
    return sendSuccess(response, await service.updateRole(request.auth!.userId, id, role))
  },

  async updateActive(request: Request, response: Response) {
    const { id } = request.validated?.params as { id: string }
    const { is_active } = request.validated?.body as { is_active: boolean }
    return sendSuccess(
      response,
      await service.updateActive(request.auth!.userId, id, is_active),
    )
  },

  async revokeSessions(request: Request, response: Response) {
    const { id } = request.validated?.params as { id: string }
    return sendSuccess(
      response,
      await service.revokeSessions(request.auth!.userId, id),
    )
  },

  async securityEvents(request: Request, response: Response) {
    const { id } = request.validated?.params as { id: string }
    return sendSuccess(response, await service.securityEvents(id))
  },
}
