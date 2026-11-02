import 'dotenv/config'

export const createS3Config = (env: Record<string, string | undefined>) => {
  // An empty S3__* value counts as unset, so the defaults below apply
  const readEnv = (name: string): string | undefined =>
    env[`S3__${name}`] || undefined

  const endpoint = readEnv('ENDPOINT') || 'localhost'
  // The adapter builds `${scheme}://${endpoint}:${port}` itself, so a URL here would
  // produce e.g. http://https://host:9000 and fail opaquely at first use. Fail at boot instead.
  if (/^https?:\/\//i.test(endpoint)) {
    throw new Error(
      `S3__ENDPOINT must be a hostname, not a URL (got '${endpoint}'). Use S3__USE_SSL and S3__PORT for scheme and port.`
    )
  }

  return {
    endpoint,
    port: parseInt(readEnv('PORT') || '9000'),
    accessKey: readEnv('ACCESS_KEY') || '',
    secretKey: readEnv('SECRET_KEY') || '',
    bucketName: readEnv('BUCKET_NAME') || 'onecore-documents',
    useSSL: readEnv('USE_SSL') === 'true',
  }
}

export default createS3Config(process.env)
