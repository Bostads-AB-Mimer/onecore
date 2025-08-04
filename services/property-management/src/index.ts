import config from './common/config'
import app from './app'
import { logger } from 'onecore-utilities'

const PORT = config.port || 5030
app.listen(PORT, () => {
  logger.info(`listening on http://localhost:${PORT}`)
})
