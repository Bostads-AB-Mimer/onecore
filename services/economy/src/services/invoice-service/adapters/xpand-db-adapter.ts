import knex from 'knex'
import config from '../../../common/config'
import { InvoiceDataRow, Invoice } from '../../../common/types'
import { logger } from 'onecore-utilities'
import { xledgerDateString } from '../../../common/types'

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

type RentalSpecificRules = Record<
  string,
  {
    costCode: string
    property: string
  }
>

type RoundOffInformation = {
  account: string
  costCode: string
}

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

let roundOffInformation: RoundOffInformation | undefined = undefined

export const getRoundOffInformation = async (
  year: string
): Promise<RoundOffInformation> => {
  if (roundOffInformation === undefined) {
    const roundOffInformationDb = await db('repsk')
      .where('keycode', 'ORESUTJ')
      .andWhere('year', year)
      .distinct()

    roundOffInformation = {
      account: roundOffInformationDb[0]['p1'],
      costCode: roundOffInformationDb[0]['p2'],
    }
  }

  if (roundOffInformation !== undefined) {
    return roundOffInformation
  } else {
    logger.error({ year }, 'Round off information not found')
    throw Error(`Round off information not found for ${year}`)
  }
}

export const getInvoices = async (rows: InvoiceDataRow[]) => {
  const uniqueInvoiceNumbers: Record<string, boolean> = {}

  rows.forEach((row) => {
    uniqueInvoiceNumbers[row.invoiceNumber as string] = true
  })

  const invoiceNumbers = Object.keys(uniqueInvoiceNumbers)

  const invoices = await db('krfkh')
    .innerJoin('revrt', 'krfkh.keyrevrt', 'revrt.keyrevrt')
    .whereIn('invoice', invoiceNumbers)
    .where('name', 'HYRA')
    .orWhere('name', 'HYRA INTERN')

  const invoiceTypes: Record<string, boolean> = {}
  invoices.forEach((invoice) => {
    invoiceTypes[invoice.name] = true
  })

  console.log(Object.keys(invoiceTypes))

  return invoices
}

const getRentArticleDetails = async (
  year: string
): Promise<RentArticleDetails> => {
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

const getRentalSpecificRules = async (rentalIds: string[], year: string) => {
  const specificRules: RentalSpecificRules = {}
  const specificRulesBuildings = await db('repsk')
    .innerJoin('babyg', 'babyg.keybabyg', 'repsk.keycode')
    .innerJoin('babuf', 'babyg.keycmobj', 'babuf.keyobjbyg')
    .where('year', year)
    .andWhereLike('keyrektk', 'INTAKT%')
    .whereIn('hyresid', rentalIds)
    .distinct()

  specificRulesBuildings.forEach((row) => {
    specificRules[row['hyresid'].toString().trimEnd()] = {
      costCode: row['p2'].toString().trimEnd(),
      property: row['p3'].toString().trimEnd(),
    }
  })

  const specificRulesAreas = await db('repsk')
    .innerJoin('bayta', 'bayta.keybayta', 'repsk.keycode')
    .innerJoin('babuf', 'bayta.keycmobj', 'babuf.keyobjyta')
    .where('year', year)
    .andWhereLike('keyrektk', 'INTAKT%')
    .whereIn('hyresid', rentalIds)
    .distinct()

  specificRulesAreas.forEach((row) => {
    specificRules[row['hyresid'].toString().trimEnd()] = {
      costCode: row['p2'].toString().trimEnd(),
      property: row['p3'].toString().trimEnd(),
    }
  })

  return specificRules
}

const getAdditionalColumns = async (
  row: InvoiceDataRow,
  rentArticleDetails: RentArticleDetails,
  rentalSpecificRules: RentalSpecificRules
): Promise<InvoiceDataRow> => {
  const rentArticleName = row.rentArticle
  const contractCode = row.contractCode as string
  const additionalColumns: InvoiceDataRow = {}

  if ('Öresutjämning' == row.invoiceRowText) {
    return {}
  }
  //const year = (row.accountingDate as string).substring(0, 4)
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
  additionalColumns['account'] = rentArticle['account']?.toString().trimEnd()
  additionalColumns['costCode'] = rentArticle['costCode']?.toString().trimEnd()
  additionalColumns['property'] = rentArticle['property']?.toString().trimEnd()
  additionalColumns['projectCode'] = rentArticle['projectCode']
    ?.toString()
    .trimEnd()
  additionalColumns['freeCode'] = rentArticle['freeCode']?.toString().trimEnd()
  additionalColumns['SumRow'] = rentArticle['sumRowText']?.toString().trimEnd()

  if (!additionalColumns['costCode'] && contractCode) {
    const specificRule = rentalSpecificRules[contractCode.split('/')[0]]

    if (specificRule) {
      additionalColumns['costCode'] = specificRule['costCode']
      additionalColumns['property'] = specificRule['property']
    } else {
      logger.error(row, 'Could not find cost code and property')
    }
  }
  return additionalColumns

  //}
  return {}
}

export const enrichInvoiceRows = async (
  invoiceDataRows: InvoiceDataRow[],
  invoiceDate: string,
  invoiceDueDate: string,
  invoices: Invoice[]
): Promise<InvoiceDataRow[]> => {
  let i = 1

  invoiceDataRows.forEach((row) => {
    const invoice = invoices.find((invoice) => {
      return (row.invoiceNumber as string).localeCompare(
        invoice.invoice as string
      )
    })

    if (invoice) {
      row.invoiceDate = xledgerDateString(invoice.invdate as Date)
      row.invoiceFromDate = xledgerDateString(invoice.fromdate as Date)
      row.invoiceToDate = xledgerDateString(invoice.todate as Date)
    } else {
      // Invoice is not found in Xpand. A common reason is that it's an
      // invoice of the wrong type, for instance reminder.
      invoiceDataRows = invoiceDataRows.filter((filterRow) => {
        return !(filterRow.invoiceNumber as string).localeCompare(
          row.invoiceNumber as string
        )
      })
      console.log(
        row.invoiceNumber,
        'Invoice not found in XPand, removed invoice rows'
      )
    }
  })

  const rentalIdMap: Record<string, boolean> = {}

  invoiceDataRows.forEach((row) => {
    rentalIdMap[row.contractCode.toString().split('/')[0]] = true
  })

  const rentalIds = Object.keys(rentalIdMap)
  const rentalSpecificRules = await getRentalSpecificRules(rentalIds, '2025')

  const rentArticleDetails = await getRentArticleDetails('2025')

  const enrichedInvoiceRows = await Promise.all(
    invoiceDataRows.map(
      async (row: InvoiceDataRow): Promise<InvoiceDataRow> => {
        const additionalColumns = await getAdditionalColumns(
          row,
          rentArticleDetails,
          rentalSpecificRules
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
