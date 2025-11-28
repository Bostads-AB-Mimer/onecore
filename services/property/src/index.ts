import { logger } from '@onecore/utilities'

import app from './app'
import port from './config/port'
import { initializeBucket } from './adapters/minio-adapter'

const PORT = port

// Initialize MinIO bucket before starting server
initializeBucket()
  .then(() => {
    logger.info('MinIO bucket initialized successfully')
    app.listen(PORT, () => {
      logger.info(`🏢 property base listening on http://localhost:${PORT}`)
      logger.info(`Swagger exposed on http://localhost:${PORT}/swagger`)
    })
  })
  .catch((error) => {
    logger.error('Failed to initialize MinIO bucket:', error)
    throw new Error('Failed to initialize MinIO bucket')
  })
