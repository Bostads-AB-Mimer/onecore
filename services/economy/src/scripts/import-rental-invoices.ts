import { logger } from '@onecore/utilities'
import config from '../common/config'
import fs from 'fs/promises'
import path, { sep } from 'node:path'
import {
  processInvoiceDataFile,
  getBatchContactsCsv,
  getBatchAggregatedRowsCsv,
  getBatchLedgerRowsCsv,
  uploadInvoiceFile,
  markBatchAsProcessed,
} from '../services/invoice-service/service'
import SftpClient from 'ssh2-sftp-client'

const companies = ['001', '006']

const sftpConfig: SftpClient.ConnectOptions = {
  host: config.rentalInvoices.sftp.host,
  username: config.rentalInvoices.sftp.username,
  password: config.rentalInvoices.sftp.password,
  port: config.rentalInvoices.sftp.port ?? 22,
}

if (config.rentalInvoices.sftp.useSshDss) {
  sftpConfig.algorithms = {
    serverHostKey: ['ssh-dss'],
  }
}

if (!config.rentalInvoices.sftp.directory) {
  throw new Error('Rental invoices sftp config is missing directory property')
}
const directory = config.rentalInvoices.sftp.directory

console.log(config.rentalInvoices.sftp)

const getExcelFilenames = async () => {
  /*const files = await fs.readdir(config.rentalInvoices.importDirectory)

  const excelFileNames = files.filter((file) => {
    return file.endsWith('.xlsx')
  })*/

  const sftp = new SftpClient()
  try {
    await sftp.connect(sftpConfig)
    logger.info('Connected to sftp')
    const files = await sftp.list(directory, (fileInfo) => {
      return fileInfo.name.toLowerCase().endsWith('.xlsx')
    })

    return files.map((fileInfo) => fileInfo.name)
  } catch (err) {
    logger.error(err, 'SFTP error')
    throw new Error('SFTP : ' + JSON.stringify(err))
  } finally {
    await sftp.end()
    logger.info('Terminated sftp connection')
  }
}

const renameExcelFile = async (excelFilename: string) => {
  await fs.unlink(
    `${config.rentalInvoices.importDirectory}${sep}${excelFilename}`
  )
  const sftp = new SftpClient()
  try {
    await sftp.connect(sftpConfig)
    logger.info({ excelFilename }, 'Connected to sftp to rename file')
    await sftp.rename(
      path.join(directory, excelFilename),
      path.join(directory, excelFilename.replace('.xlsx', '.xlsx-imported'))
    )
    logger.info({ excelFilename }, 'Renamed file')
  } catch (err) {
    throw new Error('SFTP : ' + JSON.stringify(err))
  } finally {
    await sftp.end()
    logger.info('Terminated sftp connection')
  }
}

const getFile = async (filename: string) => {
  const sftp = new SftpClient()
  try {
    await sftp.connect(sftpConfig)
    logger.info({ filename }, 'Connected to sftp to read file')
    // TODO: replace with memory stream and read directly into it.
    await sftp.get(
      path.join(directory, filename),
      path.join(config.rentalInvoices.importDirectory, filename)
    )
    logger.info(
      { filename, destination: config.rentalInvoices.importDirectory },
      'Copied file'
    )
    return filename
  } catch (err) {
    throw new Error('SFTP : ' + JSON.stringify(err))
  } finally {
    await sftp.end()
    logger.info('Terminated sftp connection')
  }
}

const importRentalInvoicesScript = async () => {
  logger.info('Checking for new rental invoices file')
  const excelFileNames = await getExcelFilenames()

  for (const excelFileName of excelFileNames) {
    for (const companyId of companies) {
      logger.info({ excelFileName, companyId }, 'Creating batch for file')
      const localExcelFileName = await getFile(excelFileName)
      const result = await processInvoiceDataFile(
        path.join(config.rentalInvoices.importDirectory, localExcelFileName),
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

    await renameExcelFile(excelFileName)
  }

  logger.info('All files processed.')
  return
}

importRentalInvoicesScript()
