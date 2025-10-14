import { logger } from '@onecore/utilities'
import {
  closeDatabases,
  getBatchAggregatedRowsCsv,
  getBatchContactsCsv,
  getBatchLedgerRowsCsv,
  importInvoiceRows,
  markBatchAsProcessed,
  uploadInvoiceFile,
} from '../services/invoice-service/service'
import fs from 'fs/promises'
import config from '../common/config'
import { sep } from 'node:path'

const importRentalInvoicesScript = async () => {
  const companyIds = ['001' /*, '006'*/]
  const earliestStartDate = new Date('2025-10-01T00:00:00.000Z')

  const startDate = new Date(
    Math.max(
      new Date().setDate(new Date().getDate() - 90),
      earliestStartDate.getTime()
    )
  )
  const endDate = new Date(new Date().setDate(startDate.getDate() + 180))

  for (const companyId of companyIds) {
    logger.info({ startDate, endDate }, 'Processing interval')
    const result = await importInvoiceRows(startDate, endDate, companyId)
    const batchId = result.batchId

    if (result.batchId) {
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

      if (aggregatedCsv) {
        await fs.writeFile(
          `${config.rentalInvoices.exportDirectory}${sep}${aggregatedFilename}`,
          aggregatedCsv
        )
      }

      logger.info({ batchId }, 'Creating ledger file for batch')
      const ledgerFilename = `${batchId}-${companyId}-ledger.gl.csv`
      const ledgerCsv = await getBatchLedgerRowsCsv(batchId)
      await fs.writeFile(
        `${config.rentalInvoices.exportDirectory}${sep}${ledgerFilename}`,
        ledgerCsv
      )

      await uploadInvoiceFile(contactsFilename, contactsCsv)
      logger.info({ contactsFilename }, 'Uploaded file')
      if (aggregatedCsv) {
        await uploadInvoiceFile(aggregatedFilename, aggregatedCsv)
        logger.info({ aggregatedFilename }, 'Uploaded file')
      }
      await uploadInvoiceFile(ledgerFilename, ledgerCsv)
      logger.info({ ledgerFilename }, 'Uploaded file')

      await markBatchAsProcessed(parseInt(batchId))
    } else {
      logger.info({ companyId }, 'No new invoices found')
    }
  }

  closeDatabases()
}

importRentalInvoicesScript()
