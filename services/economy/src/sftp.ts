import { logger } from '@onecore/utilities'
import { getBatchContactsCsv } from './services/invoice-service/service'
import fs from 'fs/promises'
import config from './common/config'
import path, { sep } from 'node:path'
import { markInvoicesAsImported } from './services/invoice-service/adapters/invoice-data-db-adapter'

const doStuff = async () => {
  const batchId = 64
  const companyId = '001'
  logger.info({ batchId }, 'Creating contact file for batch')
  /*const contactsFilename = `${batchId}-${companyId}-contacts.ar.csv`
  const contactsCsv = await getBatchContactsCsv(batchId)
  await fs.writeFile(
    `${config.rentalInvoices.exportDirectory}${sep}${contactsFilename}`,
    contactsCsv
  )*/
  await markInvoicesAsImported(batchId)
}

doStuff()
