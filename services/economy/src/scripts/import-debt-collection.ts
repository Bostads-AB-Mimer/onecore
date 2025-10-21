import { logger } from '@onecore/utilities'
import config from '../common/config'
import path from 'node:path'
import {
  enrichBalanceCorrections,
  enrichOtherInvoices,
  enrichRentInvoices,
  EnrichResponse,
} from '../services/debt-collection-service/service'
import SftpClient, { FileInfo } from 'ssh2-sftp-client'

export const importSftpConfig: SftpClient.ConnectOptions = {
  host: config.debtCollection.xledger.sftp.host,
  username: config.debtCollection.xledger.sftp.username,
  password: config.debtCollection.xledger.sftp.password,
  port: config.debtCollection.xledger.sftp.port ?? 22,
  algorithms: config.debtCollection.xledger.sftp.useSshDss
    ? {
        serverHostKey: ['ssh-dss'],
      }
    : undefined,
}

export const exportSftpConfig: SftpClient.ConnectOptions = {
  host: config.debtCollection.sergel.sftp.host,
  username: config.debtCollection.sergel.sftp.username,
  password: config.debtCollection.sergel.sftp.password,
  port: config.debtCollection.sergel.sftp.port ?? 22,
}

if (!config.debtCollection.xledger.rentInvoicesDirectory) {
  throw new Error(
    'Debt collection Xledger sftp config is missing rent invoices directory property'
  )
}

if (!config.debtCollection.xledger.otherInvoicesDirectory) {
  throw new Error(
    'Debt collection Xledger sftp config is missing other invoices directory property'
  )
}

if (!config.debtCollection.xledger.balanceCorrectionsDirectory) {
  throw new Error(
    'Debt collection Xledger sftp config is missing other balance corrections directory property'
  )
}

if (!config.debtCollection.sergel.directory) {
  throw new Error(
    'Debt collection Sergel sftp config is missing directory property'
  )
}

const exportDirectory = config.debtCollection.sergel.directory
const rentInvoicesDirectory =
  config.debtCollection.xledger.rentInvoicesDirectory
const balanceCorrectionsDirectory =
  config.debtCollection.xledger.balanceCorrectionsDirectory
const otherInvoicesDirectory =
  config.debtCollection.xledger.otherInvoicesDirectory

export type DebtCollectionFile = {
  type: 'rentInvoice' | 'otherInvoice' | 'balanceCorrection'
  directory: string
  fileName: string
}

export const getDebtCollectionFiles = async (client: SftpClient) => {
  const filter = (fileInfo: FileInfo) =>
    fileInfo.name.toLowerCase().endsWith('.csv')

  const rentInvoiceFiles = await client.list(rentInvoicesDirectory, filter)
  const balanceCorrectionFiles = await client.list(
    balanceCorrectionsDirectory,
    filter
  )
  const otherInvoiceFiles = await client.list(otherInvoicesDirectory, filter)

  return [
    ...rentInvoiceFiles.map(
      (fileInfo): DebtCollectionFile => ({
        type: 'rentInvoice',
        directory: rentInvoicesDirectory,
        fileName: fileInfo.name,
      })
    ),
    ...otherInvoiceFiles.map(
      (fileInfo): DebtCollectionFile => ({
        type: 'otherInvoice',
        directory: otherInvoicesDirectory,
        fileName: fileInfo.name,
      })
    ),
    ...balanceCorrectionFiles.map(
      (fileInfo): DebtCollectionFile => ({
        type: 'balanceCorrection',
        directory: balanceCorrectionsDirectory,
        fileName: fileInfo.name,
      })
    ),
  ]
}

export const readFile = async (
  client: SftpClient,
  filePath: string,
  encoding?:
    | 'ascii'
    | 'utf8'
    | 'utf-8'
    | 'utf16le'
    | 'utf-16le'
    | 'ucs2'
    | 'ucs-2'
    | 'base64'
    | 'base64url'
    | 'latin1'
    | 'binary'
    | 'hex'
) => {
  const contents = await client.get(filePath)
  return contents.toString(encoding)
}

export const markCsvFileAsCompleted = async (
  client: SftpClient,
  filePath: string
) => {
  await client.rename(filePath, filePath.replace(/\.csv/i, '.csv-imported'))
}

export const getExportFilePath = (fileName: string) => {
  return path.join(exportDirectory, fileName.replace(/\.csv/i, '.txt'))
}

export const createBufferForSergel = (contents: string) => {
  return Buffer.from(contents.replaceAll('\n', '\r\n'), 'latin1')
}

const enrichers: Record<
  DebtCollectionFile['type'],
  (s: string) => Promise<EnrichResponse>
> = {
  balanceCorrection: enrichBalanceCorrections,
  rentInvoice: enrichRentInvoices,
  otherInvoice: enrichOtherInvoices,
}

export const processDebtCollectionFiles = async () => {
  const importClient = new SftpClient()
  const exportClient = new SftpClient()
  const errors: string[] = []

  try {
    await importClient.connect(importSftpConfig)
    await exportClient.connect(exportSftpConfig)

    const debtCollectionFiles = await getDebtCollectionFiles(importClient)
    logger.info(
      `Processing files: ${JSON.stringify(
        debtCollectionFiles.map((file) => file.fileName),
        null,
        2
      )}`
    )

    for (const debtCollectionFile of debtCollectionFiles) {
      const fileContents = await readFile(
        importClient,
        path.join(debtCollectionFile.directory, debtCollectionFile.fileName),
        'latin1'
      )

      const response = await enrichers[debtCollectionFile.type](fileContents)

      if (!response.ok) {
        logger.error(
          response.error,
          `Failed to process file ${debtCollectionFile}`
        )
        errors.push(debtCollectionFile.fileName)
        continue
      }

      const fp = getExportFilePath(debtCollectionFile.fileName)
      const buffer = createBufferForSergel(response.file)

      await exportClient.put(buffer, fp, {
        writeStreamOptions: {
          flags: 'w',
          mode: 0o666,
        },
      })

      await markCsvFileAsCompleted(
        importClient,
        path.join(debtCollectionFile.directory, debtCollectionFile.fileName)
      )
    }

    logger.info(`${debtCollectionFiles.length} files processed.`)

    if (errors.length > 0) {
      logger.error(
        `${errors.length} errors: ${JSON.stringify(errors, null, 2)}`
      )
    }
  } catch (err) {
    logger.error(err)
    throw err
  } finally {
    await importClient.end()
    await exportClient.end()
    logger.info('Terminated sftp connections')
  }
}

if (require.main === module) {
  processDebtCollectionFiles()
}
