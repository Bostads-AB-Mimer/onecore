import app from './app'
import { logger } from '@onecore/utilities'
import { startLeaseCache } from './common/lease-cache'
import {
  fetchAllLeasesForCache,
  fetchLeasesUpdatedSinceForCache,
} from './services/lease-service/adapters/tenfast/tenfast-lease-search-adapter'

const PORT = process.env.PORT || 5020
app.listen(PORT, () => {
  logger.info(`listening on http://localhost:${PORT}`)
})

startLeaseCache(fetchAllLeasesForCache, fetchLeasesUpdatedSinceForCache)
