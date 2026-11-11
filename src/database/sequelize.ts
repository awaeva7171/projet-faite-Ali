import { Sequelize } from 'sequelize'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'

export const sequelize = new Sequelize(env.DB_NAME, env.DB_USER, env.DB_PASSWORD, {
  dialect: 'mysql',
  host: env.DB_HOST,
  port: env.DB_PORT,
  logging: env.DB_LOGGING ? (message) => logger.debug(message) : false,
  ...(env.DB_SSL ? { dialectOptions: { ssl: { rejectUnauthorized: true } } } : {}),
  define: { underscored: true, timestamps: true },
  pool: { max: 10, min: 0, acquire: 30_000, idle: 10_000 },
})

export async function connectDatabase(): Promise<void> {
  await sequelize.authenticate()
  logger.info('Connexion MySQL établie.')
}

export async function disconnectDatabase(): Promise<void> {
  await sequelize.close()
}
