import configPackage from '@iteam/config'
import dotenv from 'dotenv'
dotenv.config()

export interface Config {
  port: number
  infobip: {
    baseUrl: string
    apiKey: string
    parkingSpaceOfferTempalteId: number
    // Secret token for the public SMS delivery-report webhook. Tele2's
    // per-message webhook has no header slot, so the secret rides in the URL
    // (?token=). Email is authenticated via Keycloak in core, not here.
    webhookToken: string
    // Public URL Tele2/Infobip should POST SMS delivery reports to, e.g.
    // https://<host>/webhooks/infobip-sms (NOT /webhooks/infobip — that's the
    // Keycloak-gated email webhook). Added per-message to the SMS send when
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
  // Own scheduler for scheduled SMS/email (replaces Infobip-side scheduling).
  // Wall-clock values are Swedish local time (Europe/Stockholm).
  scheduledSends: {
    enabled: boolean // off (default): routes reject sendAt, no worker runs; only turn off when nothing is scheduled
    blockedFrom: string // 'HH:mm' start of the daily no-send window
    blockedUntil: string // 'HH:mm' end of the window; before blockedFrom = overnight
    maxDaysAhead: number
    stalenessHours: number // unsent this long after its slot -> failed
    batchSize: number // recipients per provider call
    claimMinutes: number // claim expiry; must exceed providerTimeoutMs
    providerTimeoutMs: number // well under Kubernetes' 30 s SIGTERM grace
    maxAttempts: number // hard cap on provider calls (= copies) per recipient
  }
}

const config = configPackage({
  file: `${__dirname}/../config.json`,
  defaults: {
    port: 5040,
    infobip: {
      baseUrl: '',
      apiKey: '',
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
    scheduledSends: {
      enabled: false,
      blockedFrom: '21:00',
      blockedUntil: '07:00',
      maxDaysAhead: 30,
      stalenessHours: 3,
      batchSize: 500,
      claimMinutes: 5,
      providerTimeoutMs: 20000,
      // The original send plus one retry. An unclear provider answer (5xx,
      // timeout) may still have sent, so every extra attempt can be a
      // duplicate SMS to every recipient in the batch.
      maxAttempts: 2,
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
  scheduledSends: config.get('scheduledSends'),
} as Config
