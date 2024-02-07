import configPackage from '@iteam/config'
import dotenv from 'dotenv'
dotenv.config()

export interface Config {
  port: number
  database: {
    host: string
    user: string
    password: string
    port: number
    database: string
  }
  xpandSoap: {
    username: string
    password: string
    url: string
  }
}

const config = configPackage({
  file: `${__dirname}/../config.json`,
  defaults: {
    port: 5020,
    database: {
      host: 'localhost',
      user: 'sa',
      password: '',
      port: 1433,
      database: 'tenants-leases',
    },
  },
})

export default {
  port: config.get('port'),
  database: config.get('database'),
  xpandSoap: config.get('xpandSoap'),
} as Config
