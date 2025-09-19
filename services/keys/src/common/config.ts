import configPackage from '@iteam/config'
import 'dotenv/config'

export interface Config {
  port: number
  keysDatabase: {
    host: string
    user: string
    password: string
    port: number
    database: string
  }
}

const config = configPackage({
  defaults: {
    port: 5020,
    keysDatabase: {
      host: process.env.KEYS_DB_HOST ?? 'localhost',
      user: process.env.KEYS_DB_USER ?? 'sa',
      password: process.env.KEYS_DB_PASSWORD ?? '',
      port: Number(process.env.KEYS_DB_PORT ?? 1433),
      database: process.env.KEYS_DB_NAME ?? 'keys-management',
    },
  },
})

export default {
  port: config.get('port'),
  keysDatabase: config.get('keysDatabase'),
} as Config
