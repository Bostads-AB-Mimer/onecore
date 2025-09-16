import { logger } from '@onecore/utilities'
import config from '../common/config'
import fs from 'fs/promises'
import { sep } from 'node:path'
import {
  processInvoiceDataFile,
  getBatchContactsCsv,
  getBatchAggregatedRowsCsv,
  getBatchLedgerRowsCsv,
  uploadInvoiceFile,
  markBatchAsProcessed,
} from '../services/invoice-service/service'

const companies = ['001', '006']

const importRentalInvoicesScript = async () => {
  logger.info('Checking for new rental invoices file')
  const files = await fs.readdir(config.rentalInvoices.importDirectory)

  const excelFileNames = files.filter((file) => {
    return file.endsWith('.xlsx')
  })

  for (const excelFileName of excelFileNames) {
    for (const companyId of companies) {
      logger.info({ excelFileName, companyId }, 'Creating batch for file')
      const result = await processInvoiceDataFile(
        `${config.rentalInvoices.importDirectory}${sep}${excelFileName}`,
        companyId
      )
      const batchId = result.batchId

      logger.info(
        { excelFileName, companyId },
        'Getting contact file for batch'
      )
      const contactsFilename = `${batchId}-${companyId}-contacts.ar.csv`
      const contactsCsv = await getBatchContactsCsv(batchId)
      await fs.writeFile(
        `${config.rentalInvoices.exportDirectory}${sep}${contactsFilename}`,
        contactsCsv
      )

      logger.info(
        { excelFileName, companyId },
        'Getting aggregate file for batch'
      )
      const aggregatedFilename = `${batchId}-${companyId}-aggregated.gl.csv`
      const aggregatedCsv = await getBatchAggregatedRowsCsv(batchId)
      await fs.writeFile(
        `${config.rentalInvoices.exportDirectory}${sep}${aggregatedFilename}`,
        aggregatedCsv
      )

      logger.info({ excelFileName, companyId }, 'Getting ledger file for batch')
      const ledgerFilename = `${batchId}-${companyId}-ledger.gl.csv`
      const ledgerCsv = await getBatchLedgerRowsCsv(batchId)
      await fs.writeFile(
        `${config.rentalInvoices.exportDirectory}${sep}${ledgerFilename}`,
        ledgerCsv
      )

      await uploadInvoiceFile(contactsFilename, contactsCsv)
      logger.info({ contactsFilename }, 'Uploaded file')
      await uploadInvoiceFile(aggregatedFilename, aggregatedCsv)
      logger.info({ aggregatedFilename }, 'Uploaded file')
      await uploadInvoiceFile(ledgerFilename, ledgerCsv)
      logger.info({ ledgerFilename }, 'Uploaded file')

      await markBatchAsProcessed(parseInt(batchId))
    }

    logger.info(
      { excelFileName },
      'Finished processing file, renaming to mark as processed'
    )
    await fs.rename(
      `${config.rentalInvoices.importDirectory}${sep}${excelFileName}`,
      `${config.rentalInvoices.importDirectory}${sep}${excelFileName}`.replace(
        '.xlsx',
        '.xlsx-imported'
      )
    )
  }

  logger.info('All files processed.')
  return
}

importRentalInvoicesScript()
