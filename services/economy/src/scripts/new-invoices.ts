import { logger } from '@onecore/utilities'
import {
  closeDatabases,
  getBatchAggregatedRowsCsv,
  getBatchContactsCsv,
  getBatchLedgerRowsCsv,
  importInvoiceRows,
  markBatchAsProcessed,
  missingInvoices,
} from '../services/invoice-service/service'
import fs from 'fs/promises'
import config from '../common/config'
import path, { sep } from 'node:path'

const getInvoices = async () => {
  console.log('Find missing invoices')
  await missingInvoices('24')
  await closeDatabases()
}

const importRentalInvoicesScript = async () => {
  const companyId = '001'
  for (let month = 8; month >= 8; month--) {
    logger.info({ month }, 'Processing month')
    const result = await importInvoiceRows(
      new Date('2025-09-01T00:00:00.000Z'),
      new Date('2025-10-01T00:00:00.000Z'),
      companyId
    )

    /*    const result = await importInvoiceRows(
      new Date(2025, month, 1),
      new Date(2025, month + 1, 1),
      companyId
    )*/
    const batchId = result.batchId

    logger.info({ batchId }, 'Creating contact file for batch')
    const contactsFilename = `${batchId}-${companyId}-contacts.ar.csv`
    const contactsCsv = await getBatchContactsCsv(batchId)
    await fs.writeFile(
      `${config.rentalInvoices.exportDirectory}${sep}${contactsFilename}`,
      contactsCsv
    )

    logger.info({ batchId }, 'Creating aggregate file for batch')
    const aggregatedFilename = `${batchId}-${companyId}-aggregated.gl.csv`
    const aggregatedCsv = await getBatchAggregatedRowsCsv(batchId)
    await fs.writeFile(
      `${config.rentalInvoices.exportDirectory}${sep}${aggregatedFilename}`,
      aggregatedCsv
    )

    logger.info({ batchId }, 'Creating ledger file for batch')
    const ledgerFilename = `${batchId}-${companyId}-ledger.gl.csv`
    const ledgerCsv = await getBatchLedgerRowsCsv(batchId)
    await fs.writeFile(
      `${config.rentalInvoices.exportDirectory}${sep}${ledgerFilename}`,
      ledgerCsv
    )

    /*      await uploadInvoiceFile(contactsFilename, contactsCsv)
      logger.info({ contactsFilename }, 'Uploaded file')
      await uploadInvoiceFile(aggregatedFilename, aggregatedCsv)
      logger.info({ aggregatedFilename }, 'Uploaded file')
      await uploadInvoiceFile(ledgerFilename, ledgerCsv)
      logger.info({ ledgerFilename }, 'Uploaded file')*/

    await markBatchAsProcessed(parseInt(batchId))
  }

  closeDatabases()
}

importRentalInvoicesScript()
