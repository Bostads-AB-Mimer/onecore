import 'dotenv/config'

export const createS3Config = (env: Record<string, string | undefined>) => {
  // Reads S3__<name>, falling back to the legacy MINIO__<name>.
  // Transitional MINIO__* fallback — remove in DEV-117 once no environment sets it.
  const readEnv = (name: string): string | undefined =>
    env[`S3__${name}`] ?? env[`MINIO__${name}`]

  return {
    endpoint: readEnv('ENDPOINT') || 'localhost',
    port: parseInt(readEnv('PORT') || '9000'),
    accessKey: readEnv('ACCESS_KEY') || '',
    secretKey: readEnv('SECRET_KEY') || '',
    bucketName: readEnv('BUCKET_NAME') || 'onecore-documents',
    useSSL: readEnv('USE_SSL') === 'true',
  }
}

export default createS3Config(process.env)
