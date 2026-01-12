import app from './app'
import config from './common/config'
import { logger } from '@onecore/utilities'

console.log(config)

const PORT = config.port || 5090

app.listen(PORT, () => {
  logger.info(`listening on http://localhost:${PORT}`)
})
