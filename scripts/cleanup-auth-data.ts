import { Op } from 'sequelize'
import { logger } from '../src/config/logger.js'
import { initializeModels, Models } from '../src/database/models.js'
import { connectDatabase, disconnectDatabase } from '../src/database/sequelize.js'

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000)

async function cleanup(): Promise<void> {
  initializeModels()
  await connectDatabase()

  const [refreshTokens, oneTimeTokens, auditEvents] = await Promise.all([
    Models.RefreshToken.destroy({
      where: {
        [Op.or]: [
          { expiresAt: { [Op.lt]: daysAgo(30) } },
          { revokedAt: { [Op.lt]: daysAgo(30) } },
        ],
      },
    }),
    Models.OneTimeToken.destroy({
      where: {
        [Op.or]: [
          { expiresAt: { [Op.lt]: daysAgo(7) } },
          { consumedAt: { [Op.lt]: daysAgo(7) } },
        ],
      },
    }),
    Models.AuthAuditEvent.destroy({
      where: { createdAt: { [Op.lt]: daysAgo(180) } },
    }),
  ])

  logger.info(
    {
      refresh_tokens: refreshTokens,
      one_time_tokens: oneTimeTokens,
      audit_events: auditEvents,
    },
    'Nettoyage des données d’authentification terminé.',
  )
}

cleanup()
  .catch((error) => {
    logger.error({ error }, 'Échec du nettoyage.')
    process.exitCode = 1
  })
  .finally(() => disconnectDatabase())
