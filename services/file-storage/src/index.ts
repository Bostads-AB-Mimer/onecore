import app from './app'
import config from './common/config'
import { logger } from '@onecore/utilities'
import { initializeBucket } from './adapters/s3-adapter'

const PORT = config.port || 5091

// Initialize S3 bucket before starting server
initializeBucket()
  .then(() => {
    logger.info('S3 bucket initialized successfully')
    app.listen(PORT, () => {
      logger.info(`listening on http://localhost:${PORT}`)
      logger.info(`Swagger exposed on http://localhost:${PORT}/swagger`)
    })
  })
  .catch((err) => {
    logger.error({ err }, 'Failed to initialize S3 bucket')
    throw err
  })
