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
import { sendEmail } from '../common/adapters/infobip-adapter'

const importRentalInvoicesScript = async () => {
  const companyIds = ['001', '006']
  const earliestStartDate = new Date('2025-10-01T00:00:00.000Z')
  const notification: string[] = []
  let hasErrors = false

  const startDate = new Date(
    Math.max(
      new Date().setDate(new Date().getDate() - 90),
      earliestStartDate.getTime()
    )
  )
  const endDate = new Date(new Date().setDate(startDate.getDate() + 180))

  for (const companyId of companyIds) {
    notification.push(
      `Körning startad: ${new Date().toLocaleString('sv').replace('T', ' ')}\n`
    )
    notification.push(`Hanterar hyresavier för företag ${companyId}\n`)
    logger.info({ startDate, endDate }, 'Processing interval')
    const result = await importInvoiceRows(startDate, endDate, companyId)
    const batchId = result.batchId

    if (result.batchId) {
      if (result.errors?.length && result.errors?.length > 0) {
        hasErrors = true
      }
      notification.push(`
Importerade avier: ${result.processedInvoices}
Avier med fel: ${result.errors?.length === 0 ? 'Inga' : result.errors}
        `)
      logger.info({ batchId }, 'Creating contact file for batch')
      const contactsFilename = `${batchId}-${companyId}-contacts.ar.csv`
      const contactsCsv = await getBatchContactsCsv(batchId)
      await fs.writeFile(
        `${config.rentalInvoices.exportDirectory}${sep}${contactsFilename}`,
        contactsCsv
      )
      await uploadInvoiceFile(contactsFilename, contactsCsv)
      logger.info({ contactsFilename }, 'Uploaded file')

      if (companyId !== '006') {
        // No aggregate export for Björnklockan
        logger.info({ batchId }, 'Creating aggregate file for batch')
        const aggregatedFilename = `${batchId}-${companyId}-aggregated.gl.csv`
        const aggregatedCsv = await getBatchAggregatedRowsCsv(batchId)

        if (aggregatedCsv) {
          await fs.writeFile(
            `${config.rentalInvoices.exportDirectory}${sep}${aggregatedFilename}`,
            aggregatedCsv
          )
          await uploadInvoiceFile(aggregatedFilename, aggregatedCsv)
          logger.info({ aggregatedFilename }, 'Uploaded file')
        }
      }

      logger.info({ batchId }, 'Creating ledger file for batch')
      const ledgerFilename = `${batchId}-${companyId}-ledger.gl.csv`
      const ledgerCsv = await getBatchLedgerRowsCsv(batchId)
      await fs.writeFile(
        `${config.rentalInvoices.exportDirectory}${sep}${ledgerFilename}`,
        ledgerCsv
      )

      await uploadInvoiceFile(ledgerFilename, ledgerCsv)
      logger.info({ ledgerFilename }, 'Uploaded file')

      await markBatchAsProcessed(parseInt(batchId))

      notification.push('Filer uppladdade till Xledger för import')
    } else {
      notification.push('Inga nya avier hittade sen senaste importen')
      logger.info({ companyId }, 'No new invoices found')
    }

    notification.push(
      `Körning avslutad: ${new Date().toLocaleString('sv').replace('T', ' ')}\n---\n`
    )

    if (config.scriptNotificationEmailAddresses) {
      try {
        await sendEmail(
          config.scriptNotificationEmailAddresses,
          hasErrors
            ? 'Fel i körning: import av hyresavier till Xledger'
            : 'Körning: import av hyresavier till Xledger',
          notification.join('\n')
        )
      } catch {
        // Do not fail script based on failed email.
      }
    }
  }

  closeDatabases()
}

importRentalInvoicesScript()
