import { logger } from '@onecore/utilities'
import config from '../common/config'
import fs from 'fs/promises'
import path from 'path'
import { importNewFiles } from '../services/procurement-invoice-service/service'
import {
  closeDatabases,
  uploadInvoiceFile,
} from '../services/invoice-service/service'
import { markProcurementFilesAsImported } from '../services/procurement-invoice-service/adapters/procurement-file-adapter'

const importProcurementInvoicesScript = async () => {
  logger.info('Checking for new procurement invoice files')

  const invoiceLines = await importNewFiles()
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

    markProcurementFilesAsImported()

    logger.info('Marked all files as processed.')
  } else {
    logger.info('No files to process')
  }

  closeDatabases()
}

importProcurementInvoicesScript()
