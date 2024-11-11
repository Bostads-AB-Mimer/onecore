import app from './src/app'
import { logger } from 'onecore-utilities'
import port from './src/config/port'

const PORT = port
app.listen(PORT, () => {
  logger.info(`🏢 property base listening on http://localhost:${PORT}`)
})
