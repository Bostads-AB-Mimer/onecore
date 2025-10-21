import configPackage from '@iteam/config'
import 'dotenv/config'

export interface Config {
  port: number
  xpandDatabase: {
    host: string
    user: string
    password: string
    port: number
    database: string
  }
  leasingDatabase: {
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
    messageCulture: string
  }
  creditsafe: {
    username: string
    password: string
    template: string
    url: string
  }
  health: {
    leasingDatabase: {
      systemName: string
      minimumMinutesBetweenRequests: number
    }
    xpandDatabase: {
      systemName: string
      minimumMinutesBetweenRequests: number
    }
    expiredListingsScript: {
      systemName: string
      minimumMinutesBetweenRequests: number
    }
    xpandSoapApi: {
      systemName: string
      minimumMinutesBetweenRequests: number
    }
    creditsafe: {
      systemName: string
      minimumMinutesBetweenRequests: number
    }
  }
}

const config = configPackage({
  file: `${__dirname}/../config.json`,
  defaults: {
    port: 5020,
    xpandDatabase: {
      host: '',
      user: '',
      password: '',
      port: 5432,
      database: '',
    },
    leasingDatabase: {
      host: 'localhost',
      user: 'sa',
      password: '',
      port: 1438,
      database: 'tenants-leases',
    },
    xpandSoap: {
      username: '',
      password: '',
      url: '',
      messageCulture: '1053',
    },
    creditsafe: {
      username: '',
      password: '',
      template: 'PERSON_CAS_P1',
      url: 'https://testwebservice.creditsafe.se/CAS/cas_service.asmx',
    },
    health: {
      leasingDatabase: {
        systemName: 'leasing database',
        minimumMinutesBetweenRequests: 1,
      },
      xpandDatabase: {
        systemName: 'xpand database',
        minimumMinutesBetweenRequests: 1,
      },
      expiredListingsScript: {
        systemName: 'expired listings script',
        minimumMinutesBetweenRequests: 1,
      },
      xpandSoapApi: {
        systemName: 'xpand soap api',
        minimumMinutesBetweenRequests: 2,
      },
      creditsafe: {
        systemName: 'creditsafe base url',
        minimumMinutesBetweenRequests: 2,
      },
    },
  },
})

export default {
  port: config.get('port'),
  xpandDatabase: config.get('xpandDatabase'),
  leasingDatabase: config.get('leasingDatabase'),
  xpandSoap: config.get('xpandSoap'),
  creditsafe: config.get('creditsafe'),
  health: config.get('health'),
} as Config
