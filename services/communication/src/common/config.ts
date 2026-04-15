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
    linear: {
      systemName: string
      minimumMinutesBetweenRequests: number
    }
  }
  linear: {
    url: string
    apiKey: string
    teamId: string
    projectId: string
    mimerVisibleLabelId: string
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
      linear: {
        systemName: 'linear',
        minimumMinutesBetweenRequests: 5,
      },
    },
    linear: {
      url: 'https://api.linear.app/graphql',
      apiKey: '',
      teamId: '19b92370-c7b2-44ec-a26c-0f067edc7070',
      projectId: '40e6be50-94b0-4426-a164-93a0a044d8d9',
      mimerVisibleLabelId: '278ba88a-5582-4ba0-bb3b-f7c6e7681c99',
    },
  },
})

export default {
  port: config.get('port'),
  infobip: config.get('infobip'),
  health: config.get('health'),
  linear: config.get('linear'),
} as Config
