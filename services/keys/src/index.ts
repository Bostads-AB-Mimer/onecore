import app from './app'
import { logger } from '@onecore/utilities'

const PORT = process.env.PORT || 5092

app.listen(PORT, () => {
  logger.info(`listening on http://localhost:${PORT}`)
})
