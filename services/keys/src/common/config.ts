import configPackage from '@iteam/config'
import 'dotenv/config'

export interface Config {
  port: number
  keysDatabase: {
    host: string
    user: string
    password: string
    port: number
    database: string
  }
  minio: {
    endpoint: string
    port: number
    useSsl: boolean
    accessKey: string
    secretKey: string
    bucketName: string
  }
  simpleSign: {
    apiUrl: string
    accessToken: string
    webhookUrl: string
    webhookSecret: string
  }
  alliera: {
    apiUrl: string
    username: string
    password: string
    clientId: string
    pemKey: string
    partnerId: string
    owningInstanceId: string
  }
}

const config = configPackage({
  defaults: {
    port: 5090,
    keysDatabase: {
      host: 'localhost',
      user: 'sa',
      password: '',
      port: 1438,
      database: 'keys-management',
    },
    minio: {
      endPoint: 'localhost',
      port: 9000,
      useSsl: false,
      accessKey: '',
      secretKey: '',
      bucketName: 'receipts',
    },
    simpleSign: {
      apiUrl: '',
      accessToken: '',
      webhookUrl: '',
      webhookSecret: '',
    },
    alliera: {
      apiUrl: '',
      username: '',
      password: '',
      clientId: '',
      pemKey: '',
      partnerId: '',
      owningInstanceId: '',
    },
  },
})

export default {
  port: config.get('port'),
  keysDatabase: config.get('keysDatabase'),
  minio: config.get('minio'),
  simpleSign: config.get('simplesign'),
  alliera: config.get('alliera'),
} as Config
