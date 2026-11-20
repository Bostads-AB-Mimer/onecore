import { logger } from '@onecore/utilities'
import config from '../common/config'
import fs from 'fs/promises'
import path from 'path'
import {
  importNewFiles,
  closeDatabases,
} from '../services/procurement-invoice-service/service'
import { uploadInvoiceFile } from '../services/invoice-service/service'
import { sendEmail } from '../common/adapters/infobip-adapter'
import { markProcurementFilesAsImported } from '../services/procurement-invoice-service/adapters/procurement-file-adapter'
import { recordExportedInvoices } from '../services/procurement-invoice-service/adapters/invoice-data-db-adapter'

const timestamp = () => new Date().toLocaleString('sv').replace('T', ' ')

const sendNotification = async (notification: string[]) => {
  if (!config.scriptNotificationEmailAddresses) return

  try {
    await sendEmail(
      config.scriptNotificationEmailAddresses,
      'Körning: import av fakturor från Mälarenergi',
      notification.join('\n')
    )
  } catch {
    // Do not fail script even if email fails
  }
}

const importProcurementInvoicesScript = async () => {
  const notification: string[] = [`Körning startad: ${timestamp()}\n`]
  logger.info('Checking for new procurement invoice files')

  const result = await importNewFiles()

  if (result.filenames.length === 0) {
    logger.info('No files to process')
    return
  }

  const invoiceLines = result.csvLines
  const hasNewInvoices = !!invoiceLines && invoiceLines.length > 1

  if (!hasNewInvoices && result.alreadyExported.length === 0) {
    // No invoice rows could be read from the files. Leave them on the sftp
    // server so they are retried in the next run.
    logger.error(
      { filenames: result.filenames },
      'No invoice rows could be read from the files'
    )
    return
  }

  if (hasNewInvoices) {
    const csvContent = invoiceLines.join('\n')
    const dateString = new Date()
      .toISOString()
      .substring(0, 10)
      .replaceAll('-', '')
    const exportedFilename = `${Date.now()}-001-${dateString}-malarenergi.gl.csv`
    await fs.writeFile(
      path.join(config.procurementInvoices.exportDirectory, exportedFilename),
      csvContent
    )

    await recordExportedInvoices(
      result.exportedInvoices,
      exportedFilename,
      () => uploadInvoiceFile(exportedFilename, csvContent)
    )
    logger.info(
      {
        filename: exportedFilename,
        invoices: result.exportedInvoices.length,
      },
      'Uploaded file to Xledger'
    )
  }

  const { marked, failed } = await markProcurementFilesAsImported(
    result.filenames
  )
  logger.info(
    { marked: marked.length, failed: Object.keys(failed).length },
    'Marked files as processed'
  )

  notification.push(`Importerade fakturor: ${result.exportedInvoices.length}`)
  notification.push(
    `Redan exporterade fakturor (hoppades över): ${result.alreadyExported.length > 0 ? result.alreadyExported.join(', ') : 'Inga'}`
  )
  notification.push(
    `Fakturor med fel: ${result.errors && Object.keys(result.errors).length > 0 ? JSON.stringify(result.errors) : 'Inga'}`
  )
  notification.push(`Filer markerade som importerade: ${marked.length}`)
  if (Object.keys(failed).length > 0) {
    notification.push(
      `Filer som inte kunde markeras som importerade (hämtas igen nästa körning): ${JSON.stringify(failed)}`
    )
  }
  notification.push(`Körning avslutad: ${timestamp()}\n---\n`)

  await sendNotification(notification)
}

importProcurementInvoicesScript()
  .catch((err) => {
    logger.error({ err }, 'Import of procurement invoices failed')
    process.exitCode = 1
  })
  .finally(() => closeDatabases())
