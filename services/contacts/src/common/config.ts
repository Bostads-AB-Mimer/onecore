import configPackage from '@iteam/config'
import { type KnexConnectionParameters } from '@onecore/utilities'
import dotenv from 'dotenv'
import { projectRoot } from './dirname'

dotenv.config()

export interface Config {
  port: number
  applicationName: string
  xpandDatabase: KnexConnectionParameters
  stralfors: {
    baseUrl: string
    clientId: string
    clientSecret: string
  }
  logging: {
    enabled: boolean
  }
}

const config = configPackage({
  file: `${projectRoot()}/config.json`,
  defaults: {
    port: 5093,
    applicationName: 'contacts',
    xpandDatabase: {
      healthCheckInterval: 1,
      healthCheckTimeUnit: 'm',
    },
    stralfors: {
      baseUrl: '',
      clientId: '',
      clientSecret: '',
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
  stralfors: config.get('stralfors'),
} satisfies Config
