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

  const csvContent = (await importNewFiles()).join('\n')
  await fs.writeFile(
    path.join(config.procurementInvoices.exportDirectory, 'mälarenergi.csv'),
    csvContent
  )
  await uploadInvoiceFile('malarenergi-${Date.now()}.gl.csv', csvContent)
  logger.info('Uploaded file')

  markProcurementFilesAsImported()

  logger.info('All files processed.')
  closeDatabases()
}

importProcurementInvoicesScript()
