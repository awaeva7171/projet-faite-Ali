import type { Response } from 'express'

export function sendSuccess<T>(response: Response, data: T, status = 200, meta?: unknown): Response {
  return response.status(status).json({ success: true, data, ...(meta ? { meta } : {}) })
}
  