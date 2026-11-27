import app from './app'
import config from './common/config'
import { logger } from '@onecore/utilities'

import { countOpenScheduledRecipients } from './services/scheduled-sends/adapters/db'
import { createScheduledSendsWorker } from './services/scheduled-sends/worker'

const PORT = config.port || 5040
const server = app.listen(PORT, () => {
  logger.info(`listening on http://localhost:${PORT}`)
})

// Missing flag = off: scheduling is only on when explicitly enabled.
const worker = config.scheduledSends.enabled
  ? createScheduledSendsWorker()
  : undefined
worker?.start()

// Off means no claim AND no expiry: rows already scheduled stay put until the
// flag is on again or someone cancels them. Make that visible.
if (!worker) {
  countOpenScheduledRecipients()
    .then((count) => {
      if (count > 0) {
        logger.warn(
          { count },
          'scheduled sends are disabled but scheduled recipients exist; they will not be sent or expired until the flag is on'
        )
      }
    })
    .catch((err: unknown) =>
      logger.error({ err }, 'could not count open scheduled recipients')
    )
}

// Kubernetes sends SIGTERM and waits 30 s: stop claiming, let an in-flight
// provider call settle (bounded by providerTimeoutMs), then exit.
const shutdown = (signal: string) => {
  logger.info({ signal }, 'shutting down')
  server.close()
  const stopped = worker ? worker.stop() : Promise.resolve()
  stopped
    .catch((err: unknown) => logger.error({ err }, 'worker stop failed'))
    // Deliberate: the in-flight work is done and nothing else should keep
    // the pod alive past Kubernetes' grace period.
    // eslint-disable-next-line n/no-process-exit
    .finally(() => process.exit(0))
}
process.once('SIGTERM', shutdown)
process.once('SIGINT', shutdown)
