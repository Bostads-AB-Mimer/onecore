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
  },
})

export default {
  port: config.get('port'),
  database: config.get('database'),
} as Config
