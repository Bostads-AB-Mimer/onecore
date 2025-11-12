import configPackage from '@iteam/config'
import dotenv from 'dotenv'

dotenv.config()

export interface Config {
  port: number
  applicationName: string
  xpandDatabase: {
    host: string
    user: string
    password: string
    port: number
    database: string
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
  },
})

export default {
  port: config.get('port'),
  applicationName: config.get('applicationName'),
  xpandDatabase: config.get('xpandDatabase'),
} satisfies Config
