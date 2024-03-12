import configPackage from '@iteam/config'
import dotenv from 'dotenv'
dotenv.config()

export interface Config {
  port: number
  database: {
    host: string
    user: string
    password: string
    port: number
    database: string
  }
  contechOs: {
    url: string
  }
  xpandService: {
    url: string
  },
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
    database: {
      host: 'localhost',
      user: 'sa',
      password: '',
      port: 1433,
      database: 'property-info',
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
  database: config.get('database'),
  contechOs: config.get('contechOs'),
  xpandService: config.get('xpandService'),
  xpandSoap: config.get('xpandSoap'),
} as Config
