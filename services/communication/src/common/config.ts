import configPackage from '@iteam/config'
import dotenv from 'dotenv'
dotenv.config()

export interface Config {
  port: number
  infobip: {
    baseUrl: string
    apiKey: string
    parkingSpaceOfferTempalteId: number
    // Basic-auth credentials Infobip presents when calling our delivery-report
    // webhook (POST /webhooks/infobip). Used by the email subscription path.
    // Empty in dev → auth check is skipped.
    webhookUsername: string
    webhookPassword: string
    // Secret token for the SMS path: per-message SMS delivery webhooks can't
    // send a Basic header, so the secret rides in the URL (?token=). The
    // webhook accepts either Basic or this token.
    webhookToken: string
    // Public URL Tele2/Infobip should POST SMS delivery reports to, e.g.
    // https://<host>/webhooks/infobip. Added per-message to the SMS send when
    // set; empty (dev without a tunnel) → no delivery webhook is attached.
    smsDeliveryReportUrl: string
  }
  tele2: {
    baseUrl: string
    apiKey: string
  }
  communicationDatabase: {
    host: string
    user: string
    password: string
    port: number
    database: string
  }
  health: {
    infobip: {
      systemName: string
      minimumMinutesBetweenRequests: number
    }
    tele2: {
      systemName: string
      minimumMinutesBetweenRequests: number
    }
    linear: {
      systemName: string
      minimumMinutesBetweenRequests: number
    }
    communicationDatabase: {
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
      webhookUsername: '',
      webhookPassword: '',
      webhookToken: '',
      smsDeliveryReportUrl: '',
    },
    tele2: {
      baseUrl: '',
      apiKey: '',
    },
    communicationDatabase: {
      host: '',
      user: '',
      password: '',
      port: 1438,
      database: '',
    },
    health: {
      infobip: {
        systemName: 'infobip',
        minimumMinutesBetweenRequests: 5,
      },
      tele2: {
        systemName: 'tele2',
        minimumMinutesBetweenRequests: 5,
      },
      linear: {
        systemName: 'linear',
        minimumMinutesBetweenRequests: 5,
      },
      communicationDatabase: {
        systemName: 'communication database',
        minimumMinutesBetweenRequests: 1,
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
  tele2: config.get('tele2'),
  communicationDatabase: config.get('communicationDatabase'),
  health: config.get('health'),
  linear: config.get('linear'),
} as Config
