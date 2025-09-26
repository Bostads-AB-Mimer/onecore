import { logger } from '@onecore/utilities'
import {
  getBatchContactsCsv,
  getBatchLedgerRowsCsv,
} from './services/invoice-service/service'
import fs from 'fs/promises'
import config from './common/config'
import path, { sep } from 'node:path'
import { markInvoicesAsImported } from './services/invoice-service/adapters/invoice-data-db-adapter'

const doStuff = async () => {
  const batchId = '100'
  const companyId = '001'

  logger.info({ batchId }, 'Creating ledger file for batch')
  const ledgerFilename = `${batchId}-new-${companyId}-ledger.gl.csv`
  const ledgerCsv = await getBatchLedgerRowsCsv(batchId)
  await fs.writeFile(
    `${config.rentalInvoices.exportDirectory}${sep}${ledgerFilename}`,
    ledgerCsv
  )

  //await markInvoicesAsImported(batchId)
}

doStuff()
