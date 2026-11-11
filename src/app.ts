import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { pinoHttp } from 'pino-http'
import swaggerUi from 'swagger-ui-express'
import { env } from './config/env.js'
import { logger } from './config/logger.js'
import { openApiDocument } from './config/openapi.js'
import { initializeModels } from './database/models.js'
import { sequelize } from './database/sequelize.js'
import { errorHandler } from './middlewares/error-handler.js'
import { notFound } from './middlewares/not-found.js'
import { requestId } from './middlewares/request-id.js'
import { createRateLimiter, generalRateLimitKey } from './middlewares/rate-limit.js'
import { authRouter } from './modules/auth/auth.routes.js'
import { demoRouter } from './modules/demo/demo.routes.js'
import { userRouter } from './modules/users/user.routes.js'
import { asyncHandler } from './shared/async-handler.js'
import { sendSuccess } from './shared/api-response.js'

initializeModels()

export const app = express()
app.disable('x-powered-by')
app.set('trust proxy', env.TRUST_PROXY)
app.use(requestId)
app.use(pinoHttp({ logger }))
app.use(helmet())
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }))
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: false }))
app.use(
  createRateLimiter({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX,
    keyGenerator: generalRateLimitKey,
  }),
)

app.get('/api/health', (_request, response) =>
  sendSuccess(response, {
    status: 'ok',
    uptime_seconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  }),
)
app.get(
  '/api/health/database',
  asyncHandler(async (_request, response) => {
    await sequelize.authenticate()
    return sendSuccess(response, { status: 'ok', database: 'reachable' })
  }),
)
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument))
app.use('/api/auth', authRouter)
app.use('/api/users', userRouter)
app.use('/api/demo', demoRouter)

app.use(notFound)
app.use(errorHandler)
