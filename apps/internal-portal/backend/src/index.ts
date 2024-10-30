import { logger } from 'onecore-utilities'

import app from './app'

const PORT = process.env.PORT || 7000
app.listen(PORT, () => {
  logger.info(`listening on http://localhost:${PORT}`)
})
