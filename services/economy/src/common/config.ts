import configPackage from '@iteam/config'
import dotenv from 'dotenv'
dotenv.config()

type SftpConfig = {
  host: string
  username: string
  password: string
  port?: number
  directory?: string
  glDirectory?: string
  arDirectory?: string
  useSshDss?: boolean
}

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
    sftp: SftpConfig
  }
  procurementInvoices: {
    importDirectory: string
    exportDirectory: string
    sftp: SftpConfig
  }
  rentalInvoices: {
    importDirectory: string
    exportDirectory: string
    sftp: SftpConfig
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
    rentalInvoices: {
      importDirectory: './rental-invoice-files',
      exportDirectory: './rental-invoice-export',
      sftp: {
        host: '',
        username: '',
        password: '',
        directory: 'economy',
      },
    },
    xpandDatabase: {
      port: 1433,
    },
    economyDatabase: {
      port: 1438,
    },
    procurementInvoices: {
      importDirectory: './procurement-invoices/invoices',
      exportDirectory: './procurement-invoices/export',
      sftp: {
        host: '',
        username: '',
        password: '',
        directory: 'economy',
      },
    },
    xledger: {
      url: 'https://www.xledger.net/graphql',
      apiToken: '',
      sftp: {
        host: '',
        username: '',
        password: '',
        glDirectory: '/GL',
        arDirectory: '/AR',
        useSshDss: true,
      },
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
  rentalInvoices: config.get('rentalInvoices'),
  health: config.get('health'),
} as Config
