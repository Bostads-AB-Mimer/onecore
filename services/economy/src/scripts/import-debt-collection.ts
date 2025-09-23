import { logger } from '@onecore/utilities'
import config from '../common/config'
import path from 'node:path'
import { enrichRentCases } from '../services/debt-collection-service/service'
import SftpClient from 'ssh2-sftp-client'
import { Readable } from 'node:stream'

const importSftpConfig: SftpClient.ConnectOptions = {
  host: config.debtCollection.xledgerSftp.host,
  username: config.debtCollection.xledgerSftp.username,
  password: config.debtCollection.xledgerSftp.password,
  port: config.debtCollection.xledgerSftp.port ?? 22,
  debug: console.log,
  algorithms: config.debtCollection.xledgerSftp.useSshDss
    ? {
        serverHostKey: ['ssh-dss'],
      }
    : undefined,
}

const exportSftpConfig: SftpClient.ConnectOptions = {
  host: config.debtCollection.sergelSftp.host,
  username: config.debtCollection.sergelSftp.username,
  password: config.debtCollection.sergelSftp.password,
  port: config.debtCollection.sergelSftp.port ?? 22,
  debug: console.log,
}

if (!config.debtCollection.xledgerSftp.directory) {
  throw new Error(
    'Debt collection Xledger sftp config is missing directory property'
  )
}
if (!config.debtCollection.sergelSftp.directory) {
  throw new Error(
    'Debt collection Sergel sftp config is missing directory property'
  )
}
const importDirectory = config.debtCollection.xledgerSftp.directory
const exportDirectory = config.debtCollection.sergelSftp.directory

const getCsvFilenames = async (client: SftpClient) => {
  const files = await client.list(importDirectory, (fileInfo) => {
    return fileInfo.name.toLowerCase().endsWith('.csv')
  })

  return files.map((fileInfo) => fileInfo.name)
}

const readFile = async (client: SftpClient, fileName: string) => {
  const contents = await client.get(path.join(importDirectory, fileName))
  return contents.toString()
}

const renameCsvFile = async (client: SftpClient, fileName: string) => {
  await client.rename(
    path.join(importDirectory, fileName),
    path.join(importDirectory, fileName.replace(/\.csv/i, '.csv-imported'))
  )
}

const getExportFilePath = (fileName: string) => {
  return path.join(exportDirectory, fileName.replace(/\.csv/i, '.txt'))
}

const processDebtCollectionFiles = async () => {
  const importClient = new SftpClient()
  const exportClient = new SftpClient()

  try {
    await importClient.connect(importSftpConfig)
    await exportClient.connect(exportSftpConfig)

    const csvFileNames = await getCsvFilenames(importClient)
    logger.info(csvFileNames)

    for (const csvFileName of csvFileNames) {
      const fileContents = await readFile(importClient, csvFileName)
      const response = await enrichRentCases(fileContents)
      if (!response.ok) {
        console.log(response)
        // TODO what to do if a file fails
        throw response.error
      }

      const fp = getExportFilePath(csvFileName)

      const stream = new Readable()
      stream.push(response.file)
      stream.push(null)

      await exportClient.put(stream, fp, {
        writeStreamOptions: {
          flags: 'w',
          encoding: 'latin1',
          mode: 0o666,
        },
      })

      await renameCsvFile(importClient, csvFileName)
    }
  } catch (err) {
    logger.error(err)
    throw new Error('SFTP : ' + JSON.stringify(err))
  } finally {
    await importClient.end()
    await exportClient.end()
    logger.info('Terminated sftp connections')
  }

  logger.info('All files processed.')
  return
}

processDebtCollectionFiles()
