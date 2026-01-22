import configPackage from '@iteam/config'
import dotenv from 'dotenv'

dotenv.config()

export interface DatabaseConfig {
  host: string
  user: string
  password: string
  port: number
  database: string
}

export interface Config {
  port: number
  applicationName: string
  xpandDatabase: DatabaseConfig
  logging: {
    enabled: boolean
  }
  health: {
    xpandDatabase: {
      systemName: string
      minimumMinutesBetweenRequests: number
    }
  }
}

const config = configPackage({
  file: `${__dirname}/../config.json`,
  defaults: {
    port: 5090,
    applicationName: 'contacts',
    xpandDatabase: {
      systemName: 'xpand database',
    },
    logging: {
      enabled: false,
    },
    health: {
      xpandDatabase: {
        systemName: 'xpand database',
        minimumMinutesBetweenRequests: 1,
      },
    },
  },
})

export default {
  port: config.get('port'),
  logging: config.get('logging'),
  applicationName: config.get('applicationName'),
  xpandDatabase: config.get('xpandDatabase'),
  health: config.get('health'),
} satisfies Config
