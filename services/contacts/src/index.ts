import makeApp from './app'
import config from './common/config'
import { logger } from '@onecore/utilities'
import { makeAppContext } from './context'

const appContext = makeAppContext(config)
const app = makeApp(appContext)

const PORT = config.port || 5090
app.listen(PORT, () => {
  logger.info(`listening on http://localhost:${PORT}`)
})
