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
    endPoint: string
    port: number
    useSSL: boolean
    accessKey: string
    secretKey: string
    bucketName: string
  }
}

const config = configPackage({
  defaults: {
    port: 5080,
    keysDatabase: {
      host: process.env.KEYS_DATABASE__HOST ?? 'localhost',
      user: process.env.KEYS_DATABASE__USER ?? 'sa',
      password: process.env.KEYS_DATABASE__PASSWORD ?? '',
      port: Number(process.env.KEYS_DATABASE__PORT ?? 1433),
      database: process.env.KEYS_DATABASE__DATABASE ?? 'keys-management',
    },
    minio: {
      endPoint: process.env.MINIO_ENDPOINT,
      port: Number(process.env.MINIO_PORT),
      useSSL: process.env.MINIO_USE_SSL,
      accessKey: process.env.MINIO_ACCESS_KEY,
      secretKey: process.env.MINIO_SECRET_KEY,
      bucketName: process.env.MINIO_BUCKET_NAME,
    },
  },
})

export default {
  port: config.get('port'),
  keysDatabase: config.get('keysDatabase'),
  minio: config.get('minio'),
} as Config
