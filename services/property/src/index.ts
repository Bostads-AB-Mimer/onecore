import { logger } from '@onecore/utilities'

import app from './app'
import port from './config/port'

const PORT = port

app.listen(PORT, () => {
  logger.info(`property base listening on http://localhost:${PORT}`)
  logger.info(`Swagger exposed on http://localhost:${PORT}/swagger`)
})
