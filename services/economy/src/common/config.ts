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
        host: 'sftp://192.168.1.88:30023/economy',
        username: 'economy-sftp',
        password: '6YhBXY5z6CWmvFxdUz7L',
        directory: 'economy',
      },
    },
    debtCollection: {
      xledger: {
        sftp: {
          host: 'ftp1.primeq.se',
          username: 'sftp_mimer_xledger',
          password: 'y2E3NAaw-r3aApEEKN',
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
      url: 'https://demo.xledger.net/graphql',
      apiToken:
        'AABVTOc9XgAAAAAChnH32aAkm2T5OIbdiRFPT8sS5za5hkXvcPWaZ0MiA3IZCo1J2quywzotLjnCvMmuph7J67vLmYsvchy1ZfMbwenPlYISfVOtRs6llj5H2IlgJmyHjNIkG2gIavCKusVomnU1asKLVu82MZfhuF9q3pC2dJPLMpj2oAdLN90a2a65zoQOeZssmw48Y8GS0lhwgC-3zCG4IaTe37IOMSISQT-Di4i9hih3gV2a9-DQiijqRWV6Ww6NPu3zAygMshybZ07lmWNoSOXCz3_skrOBENiTvW6tdw2qOrhaqKX0g4GfZEl-3qhdJ50BXZrssgSEHwQA',
      sftp: {
        host: 'ftp1.primeq.se',
        username: 'sftp_mimer_xledger',
        password: 'y2E3NAaw-r3aApEEKN',
        glDirectory: '/GL',
        arDirectory: '/AR',
        useSshDss: true,
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

export default {
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
  stralforsExport: config.get('stralforsExport'),
  health: config.get('health'),
} as Config
