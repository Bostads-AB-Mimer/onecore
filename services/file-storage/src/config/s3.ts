import 'dotenv/config'
import { logger } from '@onecore/utilities'

export const createS3Config = (env: Record<string, string | undefined>) => {
  // Tracks which prefix each value came from, to warn about half-renamed environments
  const fromS3: string[] = []
  const fromLegacy: string[] = []

  // Reads S3__<name>, falling back to the legacy MINIO__<name>.
  // An empty S3__* value also falls back, so a half-renamed environment keeps working.
  // Transitional MINIO__* fallback — remove in DEV-117 once no environment sets it.
  const readEnv = (name: string): string | undefined => {
    if (env[`S3__${name}`]) {
      fromS3.push(`S3__${name}`)
      return env[`S3__${name}`]
    }
    if (env[`MINIO__${name}`]) {
      fromLegacy.push(`MINIO__${name}`)
      return env[`MINIO__${name}`]
    }
    return undefined
  }

  const endpoint = readEnv('ENDPOINT') || 'localhost'
  // The adapter builds `${scheme}://${endpoint}:${port}` itself, so a URL here would
  // produce e.g. http://https://host:9000 and fail opaquely at first use. Fail at boot instead.
  if (/^https?:\/\//i.test(endpoint)) {
    throw new Error(
      `S3__ENDPOINT must be a hostname, not a URL (got '${endpoint}'). Use S3__USE_SSL and S3__PORT for scheme and port.`
    )
  }

  const config = {
    endpoint,
    port: parseInt(readEnv('PORT') || '9000'),
    accessKey: readEnv('ACCESS_KEY') || '',
    secretKey: readEnv('SECRET_KEY') || '',
    bucketName: readEnv('BUCKET_NAME') || 'onecore-documents',
    useSSL: readEnv('USE_SSL') === 'true',
  }

  if (fromS3.length > 0 && fromLegacy.length > 0) {
    logger.warn(
      { fromS3, fromLegacy },
      'S3 config mixes S3__* and legacy MINIO__* variables; rename all of them to S3__* together'
    )
  }

  return config
}

export default createS3Config(process.env)
