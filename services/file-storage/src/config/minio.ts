import 'dotenv/config'

export default {
  endpoint: process.env.MINIO__ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO__PORT || '9000'),
  accessKey: process.env.MINIO__ACCESS_KEY || '',
  secretKey: process.env.MINIO__SECRET_KEY || '',
  bucketName: process.env.MINIO__BUCKET_NAME || 'onecore-documents',
  useSSL: process.env.MINIO__USE_SSL === 'true',
}
