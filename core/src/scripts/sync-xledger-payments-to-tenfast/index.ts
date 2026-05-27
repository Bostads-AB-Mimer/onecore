import { logger } from '@onecore/utilities'
import { syncPayments, notifySyncFailure } from './sync-xledger-payments-to-tenfast'

syncPayments().catch(async (err) => {
  logger.error({ err }, 'sync-xledger-payments-to-tenfast script failed')
  await notifySyncFailure(err)
  process.exitCode = 1
})
