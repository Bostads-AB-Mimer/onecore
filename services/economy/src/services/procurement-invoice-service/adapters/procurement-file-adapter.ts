import fs from 'fs/promises'
import config from '../../../common/config'
import { XMLParser } from 'fast-xml-parser'
import path from 'path'
import { InvoiceDataRow } from '../../../common/types'
import { logger } from '@onecore/utilities'
import SftpClient from 'ssh2-sftp-client'

const sftpConfig: SftpClient.ConnectOptions = {
  host: config.procurementInvoices.sftp.host,
  username: config.procurementInvoices.sftp.username,
  password: config.procurementInvoices.sftp.password,
  port: config.procurementInvoices.sftp.port ?? 22,
}

if (config.procurementInvoices.sftp.useSshDss) {
  sftpConfig.algorithms = {
    serverHostKey: ['ssh-dss'],
  }
}

if (!config.procurementInvoices.sftp.directory) {
  throw new Error(
    'Procurement invoices sftp config is missing directory property'
  )
}
const directory = config.procurementInvoices.sftp.directory

const xmlParserOptions = {
  ignoreAttributes: false,
  ignoreNameSpace: false,
  removeNSPrefix: true,
}

enum ProcurementInvoiceType {
  electricity = 1,
  water = 2,
  heating = 3,
  cooling = 4,
  solar = 5,
}

/**
 * How many months to backdate costs from IssueDate
 * Index is month number according to Date.getMonth()
 * - i.e. 0 = January
 *
 * Example:
 * Invoice has issue date 2025-04-05, with invoice period 2025-03-01 to 2025-03-31
 * Issue date has javascript month number 3, table below indicates -1, meaning
 * the invoice will be put one month earlier than invoice, which is March.
 */
const periodMonthInformation: Record<number, number> = {
  0: -1,
  1: -1,
  2: 0,
  3: 0,
  4: -1,
  5: 0,
  6: -1,
  7: -1,
  8: -1,
  9: 0,
  10: -1, // TEMPORARY for 2025! Should be 0 from 2026 onward.
  11: -1, // TEMPORARY for 2025! Should be 0 from 2026 onward.
}

const ledgerAccount = '2460'
const subledgerNumber = '53984290'

const accountMap: Record<ProcurementInvoiceType, { costAccount: string }> = {
  [ProcurementInvoiceType.electricity]: {
    costAccount: '4611',
  },
  [ProcurementInvoiceType.water]: { costAccount: '4631' },
  [ProcurementInvoiceType.heating]: {
    costAccount: '4621',
  },
  [ProcurementInvoiceType.cooling]: {
    costAccount: '4651',
  },
  [ProcurementInvoiceType.solar]: {
    costAccount: '3692',
  },
}

const getPeriodInfo = (procurementInvoice: any) => {
  const invoiceMonth = new Date(
    Date.parse(procurementInvoice.IssueDate)
  ).getMonth()

  const monthPeriodInfo = periodMonthInformation[invoiceMonth]

  return {
    periodStart: monthPeriodInfo == 0 ? '' : monthPeriodInfo,
    numPeriods: monthPeriodInfo == 0 ? '' : 1,
  }
}

const getTaxRule = (
  totalAmount: number,
  totalVat: number,
  invoiceType: ProcurementInvoiceType
) => {
  const vatRate = Math.round((totalVat * 100) / (totalAmount - totalVat))

  switch (vatRate) {
    case 25:
      return invoiceType === ProcurementInvoiceType.solar ? '2' : '1'
    case 12:
      return invoiceType === ProcurementInvoiceType.solar ? '21' : '11'
    case 6:
      return invoiceType === ProcurementInvoiceType.solar ? '22' : '12'
    default:
      return ''
  }
}

const transformXmlToInvoiceRows = (
  procurementInvoice: any
): InvoiceDataRow[] => {
  if (
    !procurementInvoice['InvoiceLine'] ||
    procurementInvoice['InvoiceLine'].length <= 1
  ) {
    logger.error(
      { parsedXml: procurementInvoice },
      'No invoice lines in XML invoice'
    )
    throw new Error('No invoice lines in XML invoice')
  }

  let invoiceType: ProcurementInvoiceType | undefined

  let isCredit = false

  if (procurementInvoice['ID'].toString().startsWith('5')) {
    // Reimbursment for solar production, reverse amounts
    invoiceType = ProcurementInvoiceType.solar
    isCredit = true
    console.log('SOLAR!', procurementInvoice['ID'])
  } else if (procurementInvoice['ID'].toString().startsWith('3')) {
    // Credit invoice, reverse amounts
    isCredit = true
  } else {
    // Normal invoice
    switch (
      procurementInvoice['InvoiceLine'][0].Note.split(' ')[0].toLowerCase()
    ) {
      case 'elhandel':
        invoiceType = ProcurementInvoiceType.electricity
        break
      case 'elnät':
        invoiceType = ProcurementInvoiceType.electricity
        break
      case 'vatten':
        invoiceType = ProcurementInvoiceType.water
        break
      case 'fjärrvärme':
        invoiceType = ProcurementInvoiceType.heating
        break
      case 'fjärrkyla':
        invoiceType = ProcurementInvoiceType.cooling
        break
    }
  }

  if (!invoiceType) {
    logger.error(
      { invoiceLine: procurementInvoice['InvoiceLine'][0].Note },
      'Could not determine invoice type from xml'
    )
    throw new Error('Could not determine invoice type from xml')
  }

  const periodInfo = getPeriodInfo(procurementInvoice)
  let invoiceAmount =
    procurementInvoice.LegalTotal.TaxInclusiveTotalAmount['#text']
  const facilityId = procurementInvoice.Delivery.DeliveryAddress.ID.toString()
  const invoiceNumber = procurementInvoice.ID
  let vatAmount = procurementInvoice.TaxTotal.TotalTaxAmount['#text']

  if (isCredit) {
    invoiceAmount = -invoiceAmount
    vatAmount = -vatAmount
  }

  return [
    {
      invoiceNumber,
      account: ledgerAccount,
      totalAmount: -invoiceAmount,
      invoiceDate: procurementInvoice.IssueDate,
      dueDate: procurementInvoice.PaymentMeans.DuePaymentDate,
      facilityId,
      periodStart: '',
      numPeriods: '',
      subledgerNumber: subledgerNumber,
    },
    {
      invoiceNumber,
      account: accountMap[invoiceType].costAccount,
      totalAmount: invoiceAmount,
      vatCode: getTaxRule(invoiceAmount, vatAmount, invoiceType),
      facilityId,
      invoiceDate: procurementInvoice.IssueDate,
      dueDate: procurementInvoice.PaymentMeans.DuePaymentDate,
      periodStart: periodInfo.periodStart,
      numPeriods: periodInfo.numPeriods,
      subledgerNumber: subledgerNumber,
    },
  ]
}

const readXmlFiles = async (xmlFileNames: string[]) => {
  const xmlFiles: any[] = []

  for (const xmlFileName of xmlFileNames) {
    try {
      const xmlFile = await fs.readFile(
        path.join(config.procurementInvoices.importDirectory, xmlFileName)
      )
      const parser = new XMLParser(xmlParserOptions)
      const xmlContents = parser.parse(xmlFile)['Invoice']
      xmlFiles.push(xmlContents)
    } catch (err) {
      logger.error({ xmlFileName, err }, 'Error reading xml file')
    }
  }

  // Sort files to be able to group them into the same vouchers later
  const sortedXmlFiles = xmlFiles.sort((fileA: any, fileB: any) => {
    const periodInfoA = getPeriodInfo(fileA)
    const periodInfoB = getPeriodInfo(fileB)

    return (
      (fileA.IssueDate as string).localeCompare(fileB.IssueDate as string) ||
      (periodInfoA.periodStart as number) -
        (periodInfoB.periodStart as number) ||
      (periodInfoA.numPeriods as number) - (periodInfoB.numPeriods as number) ||
      (fileA.ID as number) - (fileB.ID as number)
    )
  })

  return sortedXmlFiles
}

const getXmlFilenames = async () => {
  const sftp = new SftpClient()
  try {
    await sftp.connect(sftpConfig)
    const files = await sftp.list(directory, (fileInfo) => {
      return fileInfo.name.toLowerCase().endsWith('.xml')
    })

    return files.map((fileInfo) => fileInfo.name)
  } catch (err) {
    logger.error({ err }, 'Could not get xml filenames from sftp')
    throw new Error('SFTP : ' + JSON.stringify(err))
  } finally {
    await sftp.end()
  }
}

/**
 * Copy files from sftp to local filesystem, using a single connection
 */
const getFiles = async (filenames: string[]) => {
  if (filenames.length === 0) return

  const sftp = new SftpClient()
  try {
    await sftp.connect(sftpConfig)
    for (const filename of filenames) {
      await sftp.fastGet(
        path.join(directory, filename),
        path.join(config.procurementInvoices.importDirectory, filename)
      )
    }
  } catch (err) {
    throw new Error('SFTP : ' + JSON.stringify(err))
  } finally {
    await sftp.end()
  }
}

const importedFilename = (filename: string) =>
  filename.replace(/\.xml$/i, '.xml-imported')

export const getNewProcurementInvoiceRows = async (): Promise<{
  rows: InvoiceDataRow[]
  filenames: string[]
}> => {
  const xmlFilenames = await getXmlFilenames()
  logger.info(
    { numberOfFiles: xmlFilenames.length },
    'Got xml filenames, copying files from sftp'
  )
  await getFiles(xmlFilenames)
  logger.info({ numberOfFiles: xmlFilenames.length }, 'Processing xml files')

  const xmlFiles = await readXmlFiles(xmlFilenames)

  const invoiceRows: InvoiceDataRow[] = []

  for (const xmlFile of xmlFiles) {
    try {
      const fileInvoiceRows = await transformXmlToInvoiceRows(xmlFile)

      invoiceRows.push(...fileInvoiceRows)
    } catch (err) {
      logger.error({ err }, 'Error transforming xml file')
    }
  }

  return { rows: invoiceRows, filenames: xmlFilenames }
}

/**
 * Renames the given files on the sftp server to *.xml-imported, using a
 * single connection, and removes the local copies.
 *
 * Does not throw: a file that cannot be renamed is reported in `failed` and
 * will be picked up again by the next run, where its invoices are skipped
 * because they are already recorded as exported.
 */
export const markProcurementFilesAsImported = async (
  filenames: string[]
): Promise<{ marked: string[]; failed: Record<string, string> }> => {
  const marked: string[] = []
  const failed: Record<string, string> = {}

  if (filenames.length === 0) return { marked, failed }

  const sftp = new SftpClient()
  try {
    await sftp.connect(sftpConfig)

    for (const filename of filenames) {
      try {
        await sftp.rename(
          path.join(directory, filename),
          path.join(directory, importedFilename(filename))
        )
        marked.push(filename)
      } catch (err) {
        failed[filename] = err instanceof Error ? err.message : String(err)
        logger.error({ err, filename }, 'Could not mark file as imported')
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error({ err }, 'Could not connect to sftp to mark files as imported')
    filenames
      .filter((filename) => !marked.includes(filename) && !failed[filename])
      .forEach((filename) => (failed[filename] = message))
  } finally {
    await sftp.end().catch(() => undefined)
  }

  for (const filename of filenames) {
    await fs.rm(
      path.join(config.procurementInvoices.importDirectory, filename),
      {
        force: true,
      }
    )
  }

  return { marked, failed }
}
