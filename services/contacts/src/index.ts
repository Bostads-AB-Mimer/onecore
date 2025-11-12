import app from './app'
import config from './common/config'
import { logger } from '@onecore/utilities'

const PORT = config.port || 5090
const server = app.listen(PORT, () => {
  logger.info(`listening on http://localhost:${PORT}`)
})
