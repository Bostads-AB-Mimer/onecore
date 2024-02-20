import configPackage from '@iteam/config'
import dotenv from 'dotenv'
dotenv.config()

export interface Config {
  port: number
  infobip: {
    baseUrl: string
    apiKey: string
  }
}

const config = configPackage({
  file: `${__dirname}/../config.json`,
  defaults: {
    port: 5020,
    infobip: {
      baseUrl: '',
      apiKey: '',
    },
  },
})

export default {
  port: config.get('port'),
  infobip: config.get('infobip'),
} as Config
