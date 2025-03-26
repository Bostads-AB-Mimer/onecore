import app from './app'
import config from './common/config'
import { logger } from 'onecore-utilities'

const PORT = config.port || 5080
const server = app.listen(PORT, () => {
  logger.info(`listening on http://localhost:${PORT}`)
})

server.setTimeout(0)
server.setTimeout(0)
server.requestTimeout = 0
server.keepAliveTimeout = 0
server.timeout = 0
