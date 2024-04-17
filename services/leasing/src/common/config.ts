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
      port: 1433,
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
  },
})

export default {
  port: config.get('port'),
  xpandDatabase: config.get('xpandDatabase'),
  leasingDatabase: config.get('leasingDatabase'),
  xpandSoap: config.get('xpandSoap'),
  creditsafe: config.get('creditsafe'),
} as Config
