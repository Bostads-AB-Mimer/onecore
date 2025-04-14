import knex from 'knex'
import config from '../../../common/config'
import { InvoiceDataRow } from '../types'
import { logger } from 'onecore-utilities'

const db = knex({
  connection: {
    host: config.xpandDatabase.host,
    user: config.xpandDatabase.user,
    password: config.xpandDatabase.password,
    port: config.xpandDatabase.port,
    database: config.xpandDatabase.database,
  },
  client: 'mssql',
})

const columnIndex: Record<string, number> = {
  contractCode: 1,
  contactCode: 2,
  tenantName: 3,
  contractType: 4,
  contractFromDate: 5,
  invoiceFromDate: 6,
  invoiceToDate: 7,
  rentArticle: 8,
  invoiceRowText: 9,
  rentalObjectCode: 10,
  rentalObjectName: 11,
  amount: 12,
  vat: 13,
  totalAmount: 14,
  account: 15,
  costCode: 16,
  projectCode: 17,
  freeCode: 18,
  sumRow: 19,
}

const getSpecificRules = async (contractCode: string, year: string) => {
  // Get specific rules from building or area
  let specificRules = await db('repsk')
    .innerJoin('babyg', 'babyg.keybabyg', 'repsk.keycode')
    .innerJoin('babuf', 'babyg.keycmobj', 'babuf.keyobjbyg')
    .where('year', year)
    .andWhereLike('keyrektk', 'INTAKT%')
    .andWhere('hyresid', contractCode.toString().split('/')[0])
    .distinct()

  if (!specificRules || !specificRules[0]) {
    specificRules = await db('repsk')
      .innerJoin('bayta', 'bayta.keybayta', 'repsk.keycode')
      .innerJoin('babuf', 'bayta.keycmobj', 'babuf.keyobjyta')
      .where('year', year)
      .andWhereLike('keyrektk', 'INTAKT%')
      .andWhere('hyresid', contractCode.toString().split('/')[0])
      .distinct()
  }

  return specificRules
}

const getOcrAndInvoiceNumber = async (row: InvoiceDataRow) => {
  let ocr = await db('krfkh')
    .whereLike('reference', row.contractCode)
    .andWhere('fromdate', row.invoiceFromDate)
    .andWhere('todate', row.invoiceToDate)

  if (!ocr || !ocr[0]) {
    console.log('OCR fallback', row)
    // Weird period, fall back to matching invoice date
    // with invoice from date in the excel
    ocr = await db('krfkh')
      .whereLike('reference', row.contractCode)
      .andWhere('invdate', row.invoiceFromDate)
  }

  return ocr
}

const getAdditionalColumns = async (
  row: InvoiceDataRow
): Promise<InvoiceDataRow> => {
  const rentArticleName = row.rentArticle
  const contractCode = row.contractCode as string
  const additionalColumns: InvoiceDataRow = {}
  let rentArticleResult: any[]
  const year = (row.invoiceFromDate as string).substring(0, 4)

  if ('Öresutjämning' == row.invoiceRowText) {
    rentArticleResult = await db('repsk')
      .where('keycode', 'ORESUTJ')
      .andWhere('year', year)
      .distinct()
  } else {
    rentArticleResult = await db('cmart')
      .innerJoin('repsk', 'cmart.keycmart', 'repsk.keycode')
      .leftJoin('hysum', 'cmart.keyhysum', 'hysum.keyhysum')
      .where('code', rentArticleName)
      .andWhere('keyrektk', 'INTAKT')
      .andWhere('year', year)
      .andWhere('keycmuni', 'month')
      .distinct()
  }

  if (rentArticleResult && rentArticleResult[0]) {
    const rentArticle = rentArticleResult[0]
    additionalColumns['account'] = rentArticle['p1'].toString().trimEnd()
    additionalColumns['costCode'] = rentArticle['p2'].toString().trimEnd()
    additionalColumns['property'] = rentArticle['p3'].toString().trimEnd()
    additionalColumns['projectCode'] = rentArticle['p4'].toString().trimEnd()
    additionalColumns['freeCode'] = rentArticle['p5'].toString().trimEnd()
    additionalColumns['SumRow'] = rentArticle['hysumben']?.toString().trimEnd()

    if (!additionalColumns['costCode'] && contractCode) {
      const specificRules = await getSpecificRules(contractCode, year)
      if (specificRules && specificRules[0]) {
        const specificRule = specificRules[0]
        additionalColumns['costCode'] = specificRule['p2'].toString().trimEnd()
        additionalColumns['property'] = specificRule['p3'].toString().trimEnd()
      } else {
        logger.error(row, 'Could not find cost code and property')
      }
    }

    const ocr = await getOcrAndInvoiceNumber(row)

    if (ocr && ocr[0]) {
      const ocrResult = ocr[0]
      additionalColumns['ocr'] = ocrResult['ocr']?.toString().trimEnd()
      additionalColumns['invoiceNumber'] = ocrResult['invoice']
        ?.toString()
        .trimEnd()
    } else {
      logger.error({ row }, 'OCR information not found')
    }

    return additionalColumns
  } else {
    return {}
  }
}

export const enrichInvoiceRows = async (
  invoiceDataRows: InvoiceDataRow[],
  invoiceDate: string,
  invoiceDueDate: string
): Promise<InvoiceDataRow[]> => {
  let i = 1

  const enrichedInvoiceRows = await Promise.all(
    invoiceDataRows.map(
      async (row: InvoiceDataRow): Promise<InvoiceDataRow> => {
        const additionalColumns = await getAdditionalColumns(row)

        process.stdout.clearLine(0)
        process.stdout.cursorTo(0)
        process.stdout.write('Enriching ' + (i++).toString())

        return { ...row, ...additionalColumns, invoiceDate, invoiceDueDate }
      }
    )
  )

  process.stdout.write('\n')

  return Promise.all(enrichedInvoiceRows)
}
