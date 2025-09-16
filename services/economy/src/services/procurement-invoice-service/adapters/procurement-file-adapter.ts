import fs from 'fs/promises'
import config from '../../../common/config'
import { XMLParser } from 'fast-xml-parser'
import path from 'path'
import { InvoiceDataRow } from '../../../common/types'
import { logger } from '@onecore/utilities'

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
 * Invoice has issue date 2025-06-05, with invoice period 2025-05-01 to 2025-05-31
 * Issue date month index is 5, and costs will be
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
  10: 0,
  11: 0,
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

const getTaxRule = (totalAmount: number, totalVat: number) => {
  const vatRate = Math.round((totalVat * 100) / (totalAmount - totalVat))

  switch (vatRate) {
    case 25:
      return '1'
    case 12:
      return '11'
    case 6:
      return '12'
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
      vatCode: getTaxRule(invoiceAmount, vatAmount),
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
      logger.error({ xmlFileName }, 'Error reading xml file')
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

export const getNewProcurementInvoiceRows = async () => {
  const files = await fs.readdir(config.procurementInvoices.importDirectory)

  const xmlFileNames = files.filter((file) => {
    return file.endsWith('.xml')
  })

  const invoiceRows: InvoiceDataRow[] = []

  const xmlFiles = await readXmlFiles(xmlFileNames)

  for (const xmlFile of xmlFiles) {
    try {
      const fileInvoiceRows = await transformXmlToInvoiceRows(xmlFile)

      invoiceRows.push(...fileInvoiceRows)
    } catch (err) {
      logger.error({ err }, 'Error transforming xml file')
    }
  }

  return invoiceRows
}

export const markProcurementFilesAsImported = async () => {
  const files = await fs.readdir(config.procurementInvoices.importDirectory)

  const xmlFileNames = files.filter((file) => {
    return file.endsWith('.xml')
  })

  for (const file of xmlFileNames) {
    await fs.rename(
      path.join(config.procurementInvoices.importDirectory, file),
      path.join(
        config.procurementInvoices.importDirectory,
        file.replace('.xml', '.xml-imported')
      )
    )
  }
}
