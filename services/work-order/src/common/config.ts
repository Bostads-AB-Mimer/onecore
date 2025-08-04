import configPackage from '@iteam/config'
import dotenv from 'dotenv'
dotenv.config()

export interface Config {
  port: number
  odoo: {
    url: string
    database: string
    username: string
    password: string
  }
  xpandDatabase: {
    host: string
    user: string
    password: string
    port: number
    database: string
  }
  health: {
    odoo: {
      systemName: string
      minimumMinutesBetweenRequests: number
    }
  }
}

const config = configPackage({
  file: `${__dirname}/../config.json`,
  defaults: {
    port: 5070,
    odoo: {
      url: 'http://localhost:8069',
      database: '',
      username: '',
      password: '',
    },
    xpandDatabase: {
      host: '',
      user: '',
      password: '',
      port: 5432,
      database: '',
    },
    health: {
      odoo: {
        systemName: 'odoo',
        minimumMinutesBetweenRequests: 1,
      },
    },
  },
})

export default {
  port: config.get('port'),
  odoo: config.get('odoo'),
  xpandDatabase: config.get('xpandDatabase'),
  health: config.get('health'),
} as Config
