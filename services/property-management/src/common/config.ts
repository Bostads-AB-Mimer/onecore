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
  propertyManagementDatabase: {
    host: string
    user: string
    password: string
    port: number
    database: string
  }
  xpandService: {
    url: string
  }
  xpandSoap: {
    username: string
    password: string
    url: string
    messageCulture: string
  }
}

const config = configPackage({
  file: `${__dirname}/../config.json`,
  defaults: {
    port: 5010,
    xpandDatabase: {
      host: '',
      user: '',
      password: '',
      port: 5432,
      database: '',
    },
    propertyManagementDatabase: {
      host: 'localhost',
      user: 'sa',
      password: '',
      port: 1433,
      database: 'property-management',
    },
    xpandService: {
      url: 'https://mypages-wapp-t.azurewebsites.net/api',
    },
    xpandSoap: {
      username: '',
      password: '',
      url: '',
      messageCulture: '1053',
    },
  },
})

export default {
  port: config.get('port'),
  xpandDatabase: config.get('xpandDatabase'),
  propertyManagementDatabase: config.get('propertyManagementDatabase'),
  xpandService: config.get('xpandService'),
  xpandSoap: config.get('xpandSoap'),
  appsMimerNu: config.get('appsMimerNu'),
} as Config
