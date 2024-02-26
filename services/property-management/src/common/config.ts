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
  },
})

export default {
  port: config.get('port'),
  database: config.get('database'),
  contechOs: config.get('contechOs'),
  xpandService: config.get('xpandService'),
} as Config
