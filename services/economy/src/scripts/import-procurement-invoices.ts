import { logger } from '@onecore/utilities'
import config from '../common/config'
import fs from 'fs/promises'
import path from 'path'
import { importNewFiles } from '../services/procurement-invoice-service/service'
import {
  closeDatabases,
  uploadInvoiceFile,
} from '../services/invoice-service/service'
import { sendEmail } from '../common/adapters/infobip-adapter'
import { markProcurementFilesAsImported } from '../services/procurement-invoice-service/adapters/procurement-file-adapter'

const importProcurementInvoicesScript = async () => {
  const notification: string[] = [
    `Körning startad: ${new Date().toLocaleString('sv').replace('T', ' ')}\n`,
  ]
  logger.info('Checking for new procurement invoice files')

  const invoiceLinesResult = await importNewFiles()
  const invoiceLines = invoiceLinesResult.csvLines
  if (invoiceLines && invoiceLines.length > 0) {
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
    await uploadInvoiceFile(exportedFilename, csvContent)
    logger.info({ filename: exportedFilename }, 'Uploaded file to Xledger')

    const invoiceCount = markProcurementFilesAsImported()

    logger.info('Marked all files as processed.')
    notification.push(`Importerade fakturor: ${invoiceCount}`)
    notification.push(
      `Fakturor med fel: ${Object.keys(invoiceLinesResult.errors).length > 0 ? JSON.stringify(invoiceLinesResult.errors) : 'Inga'}`
    )
  } else {
    notification.push('Inga ohanterade fakturafiler hittade')
    logger.info('No files to process')
  }

  notification.push(
    `Körning avslutad: ${new Date().toLocaleString('sv').replace('T', ' ')}\n---\n`
  )

  if (config.scriptNotificationEmailAddresses) {
    await sendEmail(
      config.scriptNotificationEmailAddresses,
      'Körning: import av hyresavier till Xledger',
      notification.join('\n')
    )
  }

  closeDatabases()
}

importProcurementInvoicesScript()
