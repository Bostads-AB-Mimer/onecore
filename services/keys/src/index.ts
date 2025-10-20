import app from './app'
import { logger } from '@onecore/utilities'
import { ensureBucketExists } from './services/key-service/adapters/minio'

const PORT = process.env.PORT || 5090

ensureBucketExists()
  .then(() => {
    logger.info('MinIO initialized successfully')
  })
  .catch((err) => {
    logger.error({ err }, 'Failed to initialize MinIO - continuing anyway')
  })

app.listen(PORT, () => {
  logger.info(`listening on http://localhost:${PORT}`)
})
