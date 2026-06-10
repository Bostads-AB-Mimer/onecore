import { logger } from '@onecore/utilities'
import { transferStralforsFiles } from './transfer-stralfors-files'

transferStralforsFiles().catch(async (err) => {
  logger.error({ err }, 'transfer-stralfors-files script failed')
  process.exitCode = 1
})
