import configPackage from '@iteam/config'
import { type KnexConnectionParameters } from '@onecore/utilities'
import dotenv from 'dotenv'
import { getDirname } from './dirname'

const __dirname = getDirname(import.meta.url)

dotenv.config()

export interface Config {
  port: number
  applicationName: string
  xpandDatabase: KnexConnectionParameters
  logging: {
    enabled: boolean
  }
}

const config = configPackage({
  file: `${__dirname}/../config.json`,
  defaults: {
    port: 5090,
    applicationName: 'contacts',
    xpandDatabase: {
      healthCheckInterval: 1,
      healthCheckTimeUnit: 'm',
    },
    logging: {
      enabled: true,
    },
  },
})

export default {
  port: config.get('port'),
  logging: config.get('logging'),
  applicationName: config.get('applicationName'),
  xpandDatabase: config.get('xpandDatabase'),
} satisfies Config
