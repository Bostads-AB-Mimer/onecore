import app from './app'
import { logger } from '@onecore/utilities'
import { startDaxCardOwnerSyncScheduler } from './services/key-service/dax-card-owner-sync'

const PORT = process.env.PORT || 5092

app.listen(PORT, () => {
  logger.info(`listening on http://localhost:${PORT}`)
  startDaxCardOwnerSyncScheduler()
})
