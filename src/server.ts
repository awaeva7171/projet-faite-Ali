import { createServer } from 'node:http'
import { app } from './app.js'
import { assertSafeProductionConfiguration, env } from './config/env.js'
import { logger } from './config/logger.js'
import { connectDatabase, disconnectDatabase } from './database/sequelize.js'

async function bootstrap(): Promise<void> {
  assertSafeProductionConfiguration()
  await connectDatabase()

  const server = createServer(app)
  server.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, docs: `${env.APP_URL}/api/docs` },
      'Cours-Alygne Auth API démarrée.',
    )
  })

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Arrêt gracieux demandé.')
    server.close(() => {
      void disconnectDatabase().finally(() => process.exit(0))
    })
  }

  process.once('SIGINT', () => shutdown('SIGINT'))
  process.once('SIGTERM', () => shutdown('SIGTERM'))
}

bootstrap().catch((error) => {
  logger.fatal({ error }, 'Impossible de démarrer le serveur.')
  process.exit(1)
})
