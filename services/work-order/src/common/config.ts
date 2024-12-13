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
    port: 5060,
    odoo: {
      url: 'http://localhost:8069',
      database: '',
      username: '',
      password: '',
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
  health: config.get('health'),
} as Config
