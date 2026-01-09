import app from './app'
import config from './common/config'
import { logger } from '@onecore/utilities'
import { initializeBucket } from './adapters/minio-adapter'

const PORT = config.port || 5091

// Initialize MinIO bucket before starting server
initializeBucket()
  .then(() => {
    logger.info('MinIO bucket initialized successfully')
    app.listen(PORT, () => {
      logger.info(`listening on http://localhost:${PORT}`)
      logger.info(`Swagger exposed on http://localhost:${PORT}/swagger`)
    })
  })
  .catch((error) => {
    logger.error('Failed to initialize MinIO bucket:', error)
    throw error
  })
