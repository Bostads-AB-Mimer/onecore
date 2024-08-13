import configPackage from '@iteam/config'
import dotenv from 'dotenv'
dotenv.config()

export interface Config {
  port: number
  infobip: {
    baseUrl: string
    apiKey: string
    parkingSpaceOfferTempalteId: number
  }
  health: {
    infobip: {
      systemName: string
      minimumMinutesBetweenRequests: number
    }
  }
}

const config = configPackage({
  file: `${__dirname}/../config.json`,
  defaults: {
    port: 5040,
    infobip: {
      baseUrl: '',
      apiKey: '',
    },
    health: {
      infobip: {
        systemName: 'infobip',
        minimumMinutesBetweenRequests: 5,
      },
    },
  },
})

export default {
  port: config.get('port'),
  infobip: config.get('infobip'),
  health: config.get('health'),
} as Config
