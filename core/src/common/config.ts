import configPackage from '@iteam/config'
import dotenv from 'dotenv'
import ms from 'ms'
dotenv.config()

interface Account {
  userName: string
  salt: string
  hash: string
}

export interface Config {
  port: number
  tenantsLeasesService: {
    url: string
  }
  propertyInfoService: {
    url: string
  }
  documentsService: {
    url: string
  }
  communicationService: {
    url: string
  }
  workOrderService: {
    url: string
  }
  minaSidor: {
    url: string
  }
  propertyBaseService: {
    url: string
  }
  economyService: {
    url: string
  }
  fileStorageService: {
    url: string
  }
  auth: {
    secret: string
    expiresIn: ms.StringValue | number
    maxFailedLoginAttempts: number
    testAccount: Account
    keycloak: {
      url: string
      realm: string
      clientId: string
      clientSecret: string
    }
  }
  emailAddresses: {
    leasing: string
    tenantDefault: string
    dev: string
  }
  health: {
    leasing: {
      systemName: string
      minimumMinutesBetweenRequests: number
    }
    propertyBase: {
      systemName: string
      minimumMinutesBetweenRequests: number
    }
    propertyManagement: {
      systemName: string
      minimumMinutesBetweenRequests: number
    }
    communication: {
      systemName: string
      minimumMinutesBetweenRequests: number
    }
    workOrder: {
      systemName: string
      minimumMinutesBetweenRequests: number
    }
  }
}

const config = configPackage({
  file: `${__dirname}/../config.json`,
  defaults: {
    port: 5010,
    tenantsLeasesService: {
      url: 'http://localhost:5020',
    },
    propertyInfoService: {
      url: 'http://localhost:5030',
    },
    documentsService: {
      url: 'https://mim-shared-apim-apim01-t.azure-api.net/document',
    },
    communicationService: {
      url: 'http://localhost:5040',
    },
    workOrderService: {
      url: 'http://localhost:5070',
    },
    minaSidor: {
      url: 'https://test.mimer.nu/',
    },
    propertyBaseService: {
      url: 'http://localhost:5050',
    },
    economyService: {
      url: 'http://localhost:5080',
    },
    fileStorageService: {
      url: 'http://localhost:5091',
    },
    auth: {
      secret: 'very secret. replace this',
      expiresIn: '3h', // format allowed by https://github.com/zeit/ms
      maxFailedLoginAttempts: 3,
      keycloak: {
        url: 'http://localhost:8080/auth',
        realm: 'onecore-test',
        clientId: 'onecore-test',
        clientSecret: 'your-client-secret',
      },
    },
    emailAddresses: {
      leasing: '',
      tenantDefault: '',
    },
    health: {
      leasing: {
        systemName: 'leasing',
        minimumMinutesBetweenRequests: 1,
      },
      propertyBase: {
        systemName: '@onecore/property',
        minimumMinutesBetweenRequests: 1,
      },
      propertyManagement: {
        systemName: 'property-management',
        minimumMinutesBetweenRequests: 1,
      },
      communication: {
        systemName: 'communication',
        minimumMinutesBetweenRequests: 1,
      },
      workOrder: {
        systemName: 'work-order',
        minimumMinutesBetweenRequests: 1,
      },
      economy: {
        systemName: 'economy',
        minimumMinutesBetweenRequests: 1,
      },
    },
  },
})

export default {
  port: config.get('port'),
  tenantsLeasesService: config.get('tenantsLeasesService'),
  propertyInfoService: config.get('propertyInfoService'),
  documentsService: config.get('documentsService'),
  communicationService: config.get('communicationService'),
  workOrderService: config.get('workOrderService'),
  economyService: config.get('economyService'),
  minaSidor: config.get('minaSidor'),
  emailAddresses: config.get('emailAddresses'),
  auth: config.get('auth'),
  health: config.get('health'),
  propertyBaseService: config.get('propertyBaseService'),
  fileStorageService: config.get('fileStorageService'),
} as Config
