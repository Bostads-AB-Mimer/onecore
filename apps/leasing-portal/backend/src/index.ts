import { logger } from '@onecore/utilities'
import config from './common/config'
import { makeAppContext } from './context'
import makeApp from './app'

const app = makeApp(makeAppContext(config))

app.listen(config.port, () => {
  logger.info(
    `listening on http://localhost:${config.port}${config.routePrefix}`
  )
})
