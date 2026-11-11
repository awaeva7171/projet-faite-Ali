require('dotenv').config()

const common = {
  dialect: 'mysql',
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'cours_alygne_auth',
  logging: false,
  charset: 'utf8mb4',
  collate: 'utf8mb4_unicode_ci',
  define: { underscored: true, timestamps: true },
}

module.exports = {
  development: common,
  test: { ...common, database: process.env.DB_TEST_NAME || 'cours_alygne_auth_test' },
  production: {
    ...common,
    dialectOptions: process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: true } } : {},
  },
}
