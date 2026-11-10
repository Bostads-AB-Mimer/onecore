import configPackage from '@iteam/config'
import dotenv from 'dotenv'
import { MimerCompany } from './types/typesv2'
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
  hostFingerprint?: string
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
  stralfors: {
    baseUrl: string
    clientId: string
    clientSecret: string
    retryBackoffMs: number
    maxRetries: number
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
  tenfast: {
    baseUrl: string
    apiKey: string
    companyId: string
  }
  companies: MimerCompany[]
  // Article codes that are exempt from the requirement of having a rental
  // object (hyresobjekt) on an invoice row with accounting.
  rentalObjectRequirementExceptions: string[]
  // Accounts that are never part of rental loss accounting. Rental loss rows
  // with one of them as income or cost account are left out of the file.
  rentalLossExcludedAccounts: string[]
  stralforsExport: {
    sftp: SftpConfig
    notificationEmail: string
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
    stralfors: {
      retryBackoffMs: 500,
      maxRetries: 10,
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
    tenfast: {
      baseUrl: '',
      apiKey: '',
      companyId: '',
    },
    // JSON array of MimerCompany, set via the COMPANIES env var
    companies: '[]',
    rentalObjectRequirementExceptions: ['FAKT AVG'],
    // 2425 Hemförsäkring is not rental loss
    rentalLossExcludedAccounts: ['2425'],
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
    stralforsExport: {
      sftp: {
        host: '',
        username: '',
        password: '',
        port: 22,
        directory: 'TEST',
        hostFingerprint: '',
      },
      notificationEmail: '',
    },
  },
})

const resolvedConfig = {
  port: config.get('port'),
  xpandDatabase: config.get('xpandDatabase'),
  economyDatabase: config.get('economyDatabase'),
  xledger: config.get('xledger'),
  stralfors: config.get('stralfors'),
  procurementInvoices: config.get('procurementInvoices'),
  rentalInvoices: config.get('rentalInvoices'),
  debtCollection: config.get('debtCollection'),
  scriptNotificationEmailAddresses: config.get(
    'scriptNotificationEmailAddresses'
  ),
  infobip: config.get('infobip'),
  tenfast: config.get('tenfast'),
  companies: JSON.parse(config.get('companies')),
  rentalObjectRequirementExceptions: config.get(
    'rentalObjectRequirementExceptions'
  ),
  rentalLossExcludedAccounts: config.get('rentalLossExcludedAccounts'),
  stralforsExport: config.get('stralforsExport'),
  health: config.get('health'),
} as Config

export default resolvedConfig

/**
 * Determines whether an invoice row with the given rental article code is
 * exempt from the requirement of having a rental object (hyresobjekt).
 * Comparison is case-insensitive and ignores surrounding whitespace.
 */
export const isRentalObjectRequirementException = (
  rentArticleName: string | undefined | null
): boolean => {
  if (!rentArticleName) {
    return false
  }

  const normalized = rentArticleName.trim().toUpperCase()

  return resolvedConfig.rentalObjectRequirementExceptions.some(
    (code) => code.trim().toUpperCase() === normalized
  )
}

/**
 * Determines whether an account is excluded from rental loss accounting
 * (see rentalLossExcludedAccounts).
 */
export const isRentalLossExcludedAccount = (
  account: number | string | undefined | null
): boolean => {
  if (account === undefined || account === null) {
    return false
  }

  return resolvedConfig.rentalLossExcludedAccounts.some(
    (excluded) => excluded.trim() === account.toString().trim()
  )
}
