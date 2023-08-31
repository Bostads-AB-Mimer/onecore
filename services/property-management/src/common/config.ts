import configPackage from '@iteam/config'

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
  documentsService: {
    url: string
  }
  contechOs: {
    url: string
  }
  auth: {
    secret: string
    expiresIn: string
    maxFailedLoginAttempts: number
    testAccount: Account
  }
}

const config = configPackage({
  file: `${__dirname}/../config.json`,
  defaults: {
    port: 5010,
    tenantsLeasesService: {
      url: 'http://localhost:5020',
    },
    documentsService: {
      url: 'https://mim-shared-apim-apim01-t.azure-api.net/document',
    },
    auth: {
      secret: 'very secret. replace this',
      expiresIn: '3h', // format allowed by https://github.com/zeit/ms
      maxFailedLoginAttempts: 3,
    },
  },
})

export default {
  port: config.get('port'),
  tenantsLeasesService: config.get('tenantsLeasesService'),
  documentsService: config.get('documentsService'),
  contechOs: config.get('contechOs'),
  auth: config.get('auth'),
} as Config
