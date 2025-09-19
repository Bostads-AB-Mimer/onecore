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
    port: 5080,
    keysDatabase: {
      host: process.env.KEYS_DATABASE__HOST ?? 'localhost',
      user: process.env.KEYS_DATABASE__USER ?? 'sa',
      password: process.env.KEYS_DATABASE__PASSWORD ?? '',
      port: Number(process.env.KEYS_DATABASE__PORT ?? 1433),
      database: process.env.KEYS_DATABASE__DATABASE ?? 'keys-management',
    },
  },
})

export default {
  port: config.get('port'),
  keysDatabase: config.get('keysDatabase'),
} as Config
