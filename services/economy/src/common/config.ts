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
  scriptNotificationEmailAddresses: string
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
    requestPolicy: {
      maxAttempts: number
      baseDelayMs: number
      maxDelayMs: number
      timeoutMs: number
      maxConcurrency: number
    }
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
  debtCollection: {
    xledger: {
      sftp: SftpConfig
      rentInvoicesDirectory: string
      otherInvoicesDirectory: string
      balanceCorrectionsDirectory: string
    }
    sergel: {
      sftp: SftpConfig
      directory: string
    }
  }
  infobip: {
    baseUrl: string
    apiKey: string
  }
  health: {
    xledger: {
      systemName: string
      minimumMinutesBetweenRequests: number
    }
    economyDatabase: {
      systemName: string
      minimumMinutesBetweenRequests: number
    }
    xpandDatabase: {
      systemName: string
      minimumMinutesBetweenRequests: number
    }
  }
}

const config = configPackage({
  file: `${__dirname}/../config.json`,
  defaults: {
    port: 5080,
    scriptNotificationEmailAddresses: '',
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
    debtCollection: {
      xledger: {
        sftp: {
          host: '',
          username: '',
          password: '',
          useSshDss: true,
        },
        rentInvoicesDirectory: '',
        otherInvoicesDirectory: '',
        balanceCorrectionsDirectory: '',
      },
      sergel: {
        sftp: {
          host: '',
          username: '',
          password: '',
        },
        directory: '',
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
        directory: '.',
        useSshDss: true,
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
      // Xledger bills per invoice fetched (we believe), so retries and concurrency are capped.
      // Timeout is generous: the invoices tab can take >15 s for tenants with many leases.
      requestPolicy: {
        maxAttempts: 5,
        baseDelayMs: 1000,
        maxDelayMs: 10_000,
        timeoutMs: 60_000,
        maxConcurrency: 5,
      },
    },
    infobip: {
      baseUrl: '',
      apiKey: '',
    },
    health: {
      xledger: {
        systemName: 'xledger',
        minimumMinutesBetweenRequests: 5,
      },
      economyDatabase: {
        systemName: 'economy database',
        minimumMinutesBetweenRequests: 5,
      },
      xpandDatabase: {
        systemName: 'xpand database',
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
  debtCollection: config.get('debtCollection'),
  scriptNotificationEmailAddresses: config.get(
    'scriptNotificationEmailAddresses'
  ),
  infobip: config.get('infobip'),
  health: config.get('health'),
} as Config
