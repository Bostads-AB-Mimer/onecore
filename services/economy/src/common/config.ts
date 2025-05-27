import configPackage from '@iteam/config'
import dotenv from 'dotenv'
dotenv.config()

export interface Config {
  port: number
  xpandDatabase: {
    host: string
    user: string
    password: string
    port: number
    database: string
  }
  economyDatabase: {
    host: string
    user: string
    password: string
    port: number
    database: string
  }
  xledger: {
    url: string
    apiToken: string
  }
  procurementInvoices: {
    directory: string
  }
  health: {
    xledger: {
      systemName: string
      minimumMinutesBetweenRequests: number
    }
  }
}

const config = configPackage({
  file: `${__dirname}/../config.json`,
  defaults: {
    port: 5080,
    xpandDatabase: {
      port: 1433,
    },
    economyDatabase: {
      port: 1438,
    },
    procurementInvoices: {
      directory: './procurement-invoices',
    },
    xledger: {
      url: 'https://www.xledger.net/graphql',
      apiToken: '',
    },
    health: {
      xledger: {
        systemName: 'xledger',
        minimumMinutesBetweenRequests: 5,
      },
    },
  },
})

export default {
  port: config.get('port'),
  xpandDatabase: config.get('xpandDatabase'),
  economyDatabase: config.get('economyDatabase'),
  xledger: config.get('xledger'),
  procurementInvoices: config.get('procurementInvoices'),
  health: config.get('health'),
} as Config
