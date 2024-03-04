import configPackage from '@iteam/config'
import dotenv from 'dotenv'
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
  auth: {
    secret: string
    expiresIn: string
    maxFailedLoginAttempts: number
    testAccount: Account
  }
  emailAddresses: {
    leasing: string
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
    auth: {
      secret: 'very secret. replace this',
      expiresIn: '3h', // format allowed by https://github.com/zeit/ms
      maxFailedLoginAttempts: 3,
    },
    emailAddresses: {
      leasing: 'uthyrning@mimer.nu',
    },
  },
})

export default {
  port: config.get('port'),
  tenantsLeasesService: config.get('tenantsLeasesService'),
  propertyInfoService: config.get('propertyInfoService'),
  documentsService: config.get('documentsService'),
  communicationService: config.get('communicationService'),
  emailAddresses: config.get('emailAddresses'),
  auth: config.get('auth'),
} as Config
