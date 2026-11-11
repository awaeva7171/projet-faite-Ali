import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createRateLimiter } from './rate-limit.js'
import { requestId } from './request-id.js'

describe('rate limiting', () => {
  it('retourne une erreur 429 normalisée avec request_id', async () => {
    const testApp = express()
    testApp.use(requestId)
    testApp.use(createRateLimiter({ windowMs: 60_000, limit: 1 }))
    testApp.get('/test', (_request, response) => response.json({ success: true }))

    await request(testApp).get('/test').expect(200)
    const response = await request(testApp).get('/test').expect(429)

    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'TOO_MANY_ATTEMPTS' },
    })
    expect(response.body.request_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
    expect(response.headers['x-request-id']).toBe(response.body.request_id)
  })
})
