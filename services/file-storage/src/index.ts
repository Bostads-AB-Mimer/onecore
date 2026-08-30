import app from './app'
import config from './common/config'
import { logger } from '@onecore/utilities'
import {
  initializeBucket,
  initializePublicBucket,
} from './adapters/minio-adapter'

const PORT = config.port || 5091

// Initialize MinIO buckets (private + public) before starting server
Promise.all([initializeBucket(), initializePublicBucket()])
  .then(() => {
    logger.info('MinIO buckets initialized successfully')
    app.listen(PORT, () => {
      logger.info(`listening on http://localhost:${PORT}`)
      logger.info(`Swagger exposed on http://localhost:${PORT}/swagger`)
    })
  })
  .catch((error) => {
    logger.error('Failed to initialize MinIO buckets:', error)
    throw error
  })
