import knex from 'knex'
import config from '../common/config'
import { InvoiceDataRow } from '../common/types'
import { logger } from 'onecore-utilities'

type FacilityDistributions = Record<
  string,
  { propertyCode: string; costCode: string; distributionPercentage: number }
>

type RentArticleDetails = Record<
  string,
  {
    account: string
    costCode: string
    property: string
    projectCode: string
    freeCode: string
    sumRowText: string
  }
>

const db = knex({
  connection: {
    host: config.xpandDatabase.host,
    user: config.xpandDatabase.user,
    password: config.xpandDatabase.password,
    port: config.xpandDatabase.port,
    database: config.xpandDatabase.database,
    requestTimeout: 15000,
  },
  client: 'mssql',
})

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

const getInvoices = async (rows: InvoiceDataRow[]) => {
  const uniqueInvoiceNumbers: Record<string, boolean> = {}

  rows.forEach((row) => {
    uniqueInvoiceNumbers[row.invoiceNumber as string] = true
  })

  const invoiceNumbers = Object.keys(uniqueInvoiceNumbers)

  const invoices = await db('krfkh').whereIn('invoice', invoiceNumbers)

  return invoices
}

const getRentArticleDetails = async (
  year: string
): Promise<RentArticleDetails> => {
  console.log('Getting rent article details')
  const rentArticleQuery = db('cmart')
    .innerJoin('repsk', 'cmart.keycmart', 'repsk.keycode')
    .leftJoin('hysum', 'cmart.keyhysum', 'hysum.keyhysum')
    .andWhere('keyrektk', 'INTAKT')
    .andWhere('year', year)
    .andWhere('keycmuni', 'month')
    .distinct()

  const rentArticleResult = await rentArticleQuery
  const rentArticleDetails: RentArticleDetails = {}

  rentArticleResult.forEach((rentArticle) => {
    rentArticleDetails[rentArticle.code.toString().trimEnd()] = {
      account: rentArticle['p1'].toString().trimEnd(),
      costCode: rentArticle['p2'].toString().trimEnd(),
      property: rentArticle['p3'].toString().trimEnd(),
      projectCode: rentArticle['p4'].toString().trimEnd(),
      freeCode: rentArticle['p5'].toString().trimEnd(),
      sumRowText: rentArticle['hysumben']?.toString().trimEnd(),
    }
  })

  return rentArticleDetails
}

const getAdditionalColumns = async (
  row: InvoiceDataRow,
  rentArticleDetails: RentArticleDetails
): Promise<InvoiceDataRow> => {
  const rentArticleName = row.rentArticle
  const contractCode = row.contractCode as string
  const additionalColumns: InvoiceDataRow = {}
  const year = (row.accountingDate as string).substring(0, 4)
  //  const year = (row.invoiceFromDate as string).substring(0, 4)
  /*  let rentArticleResult: any[]*/

  /*  if ('Öresutjämning' == row.invoiceRowText) {
    rentArticleResult = await db('repsk')
      .where('keycode', 'ORESUTJ')
      .andWhere('year', year)
      .distinct()
  } else {*/
  /*const rentArticleQuery = db('cmart')
    .innerJoin('repsk', 'cmart.keycmart', 'repsk.keycode')
    .leftJoin('hysum', 'cmart.keyhysum', 'hysum.keyhysum')
    .where('code', rentArticleName)
    .andWhere('keyrektk', 'INTAKT')
    .andWhere('year', year)
    .andWhere('keycmuni', 'month')
    .distinct()*/

  const rentArticle = rentArticleDetails[rentArticleName]

  if (!rentArticle) {
    console.error({ rentArticleName }, 'Rent article details not found')
    return {}
  }
  additionalColumns['account'] = rentArticle['account']
  additionalColumns['costCode'] = rentArticle['costCode']
  additionalColumns['property'] = rentArticle['property']
  additionalColumns['projectCode'] = rentArticle['projectCode']
  additionalColumns['freeCode'] = rentArticle['freeCode']
  additionalColumns['SumRow'] = rentArticle['sumRowText']?.toString().trimEnd()

  if (!additionalColumns['costCode'] && contractCode) {
    console.log('Getting specific rules')
    const specificRules = await getSpecificRules(contractCode, year)
    if (specificRules && specificRules[0]) {
      const specificRule = specificRules[0]
      additionalColumns['costCode'] = specificRule['p2'].toString().trimEnd()
      additionalColumns['property'] = specificRule['p3'].toString().trimEnd()
    } else {
      logger.error(row, 'Could not find cost code and property')
    }
  }
  return additionalColumns

  //}
  return {}

  /*    const ocr = await getOcrAndInvoiceNumber(row)

    if (ocr && ocr[0]) {
      const ocrResult = ocr[0]
      additionalColumns['ocr'] = ocrResult['ocr']?.toString().trimEnd()
      additionalColumns['invoiceNumber'] = ocrResult['invoice']
        ?.toString()
        .trimEnd()
    } else {
      logger.error({ row }, 'OCR information not found')
    }*/
}

export const enrichInvoiceRows = async (
  invoiceDataRows: InvoiceDataRow[],
  invoiceDate: string,
  invoiceDueDate: string
): Promise<InvoiceDataRow[]> => {
  let i = 1

  const invoices = await getInvoices(invoiceDataRows)
  invoiceDataRows.forEach((row) => {
    const invoice = invoices.find((invoice) => {
      return (row.invoiceNumber as string).localeCompare(invoice.invoice)
    })

    if (invoice) {
      row.invoiceDate = invoice.invoiceDate
      row.invoiceFromDate = invoice.fromDate
      row.invoiceToDate = invoice.toDate
    } else {
      console.error(
        { invoiceNumber: row.invoiceNumber },
        'Invoice not found in XPand'
      )
    }
  })

  const rentArticleDetails = await getRentArticleDetails('2025')

  const enrichedInvoiceRows = await Promise.all(
    invoiceDataRows.map(
      async (row: InvoiceDataRow): Promise<InvoiceDataRow> => {
        const additionalColumns = await getAdditionalColumns(
          row,
          rentArticleDetails
        )

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

const getDistributions = async (
  facilityId: string,
  year: string
): Promise<FacilityDistributions> => {
  // NOTE! This is a very non-standard way of sanitizing input parameters. It is used
  // here because knex has a bug where the query times out if facilityId is passed
  // as a parameter.
  if (!/^\d+$/.test(facilityId)) {
    throw new Error('Wrong format for facility id')
  }

  const query = db('cmval')
    .select('value', 'bafst.code', 'p2')
    .innerJoin('cmvat', 'cmval.keycmvat', 'cmvat.keycmvat')
    .innerJoin('cmvap', 'cmvap.keycmvat', 'cmvat.keycmvat')
    .innerJoin('babyg', 'keycode', 'babyg.keycmobj')
    .innerJoin('babuf', 'keyobjbyg', 'babyg.keycmobj')
    .innerJoin('bafst', 'keyobjfst', 'bafst.keycmobj')
    .innerJoin('drfor', 'drfor.keycmobj', 'babyg.keycmobj')
    .innerJoin('drmhf', 'drfor.keydrmhf', 'drmhf.keydrmhf')
    .innerJoin('drmpt', 'drmpt.keydrmpt', 'drmhf.keydrmpt')
    .innerJoin('repsk', 'repsk.keycode', 'babyg.keybabyg')
    .where('keycmtyp', 'babyg')
    .where('cmval.keycmvat', 'AREATEMP')
    .whereRaw(`mptanlid = '${facilityId}'`)
    .whereNull('keyobjrum')
    .whereNull('keyobjbdl')
    .whereNull('keyobjvan')
    .whereNull('keyobjsys')
    .where('repsk.keydbtbl', 'babyg')
    .where('repsk.year', year)
    .where('repsk.keyrektk', 'INKOP')

  const areaTemps = await query

  const distributions: FacilityDistributions = {}

  const areaTempTotal = areaTemps.reduce((sum, tempRow) => {
    return sum + tempRow.value
  }, 0)

  areaTemps.forEach((areaTemp) => {
    const property = areaTemp.code.trimEnd()
    if (!distributions[property]) {
      distributions[property] = {
        propertyCode: property,
        costCode: areaTemp.p2.trimEnd(),
        distributionPercentage: 0,
      }
    }

    distributions[property].distributionPercentage +=
      areaTemp.value / areaTempTotal
  })

  // If distributionPercentage is 0, there is no distribution. Set to 1.
  for (const [propertyId, distribution] of Object.entries(distributions)) {
    if (distribution.distributionPercentage === 0) {
      distribution.distributionPercentage = 1
    }
  }

  return distributions
}

export const enrichProcurementInvoiceRows = async (
  invoiceDataRows: InvoiceDataRow[]
): Promise<{
  rows: InvoiceDataRow[]
  missingFacilities: Record<string, string>
}> => {
  const enrichedInvoiceRows: InvoiceDataRow[] = []
  const missingFacilities: Record<string, string> = {}
  let facilityId = invoiceDataRows[0].facilityId as string
  let facilityDistributions: FacilityDistributions = await getDistributions(
    invoiceDataRows[0].facilityId as string,
    (invoiceDataRows[0].invoiceDate as string).substring(0, 4)
  )

  for (const invoiceDataRow of invoiceDataRows) {
    if ((invoiceDataRow.facilityId as string).localeCompare(facilityId)) {
      facilityId = invoiceDataRow.facilityId as string
      facilityDistributions = await getDistributions(
        invoiceDataRow.facilityId as string,
        (invoiceDataRow.invoiceDate as string).substring(0, 4)
      )
    }

    if (
      facilityDistributions &&
      Object.keys(facilityDistributions).length > 0
    ) {
      if ((invoiceDataRow.account as string).startsWith('4')) {
        Object.keys(facilityDistributions).forEach((propertyId: string) => {
          const distribution = facilityDistributions[propertyId]
          const distributionDataRow: InvoiceDataRow = { ...invoiceDataRow }
          distributionDataRow.propertyCode = distribution.propertyCode
          distributionDataRow.costCode = distribution.costCode
          distributionDataRow.totalAmount =
            (distributionDataRow.totalAmount as number) *
            distribution.distributionPercentage

          distributionDataRow.totalAmount =
            Math.round(
              (distributionDataRow.totalAmount + Number.EPSILON) * 100
            ) / 100

          enrichedInvoiceRows.push(distributionDataRow)
        })
      } else {
        enrichedInvoiceRows.push(invoiceDataRow)
      }
    } else {
      missingFacilities[invoiceDataRow.invoiceNumber as string] =
        invoiceDataRow.facilityId as string
    }
  }

  return { rows: enrichedInvoiceRows, missingFacilities }
}
