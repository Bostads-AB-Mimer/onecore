/**
 * Xpand queries for the legacy rental invoice import (import-rental-invoices),
 * which exports accounting for rental invoices created in Xpand to Xledger.
 * Rental invoices created in Tenfast are handled by the invoice-service.
 */
import knex from 'knex'
import { chunk, logger } from '@onecore/utilities'

import config from '@src/common/config'
import {
  InvoiceDataRow,
  Invoice as InvoiceRecord,
  xledgerDateString,
} from '@src/common/types'
import { getRentalSpecificRules } from '@src/services/invoice-service/adapters/xpand-db-adapter'

type RentalSpecificRule = {
  costCode: string
  property: string
  projectCode?: string
  freeCode?: string
}

// SQL Server allows at most ~2100 parameters per query.
const MAX_PARAMETERS = 1000

const db = knex({
  connection: {
    host: config.xpandDatabase.host,
    user: config.xpandDatabase.user,
    password: config.xpandDatabase.password,
    port: config.xpandDatabase.port,
    database: config.xpandDatabase.database,
    requestTimeout: 120000,
  },
  pool: { min: 0, max: 10 },
  client: 'mssql',
})

export const closeDb = () => {
  db.destroy()
}

// SQL types of the Xpand columns that string bindings are compared with
const INVOICE_NUMBER_TYPE = 'VARCHAR(25)' // krfkh.invoice
const ACCOUNTING_RULE_CODE_TYPE = 'CHAR(15)' // repsr.keycode

/**
 * Placeholders for string bindings, cast to the type of the column they are
 * compared with. String bindings are sent as NVARCHAR, and comparing a
 * VARCHAR column with NVARCHAR converts the column on every row, so SQL
 * Server cannot use its index (about 60 s instead of 0.3 s for 1000
 * invoice numbers in krfkh).
 */
const placeholders = (values: unknown[], sqlType: string) =>
  values.map(() => `CAST(? AS ${sqlType})`).join(',')

const getRentalRowSpecificRule = async (
  row: InvoiceDataRow
): Promise<RentalSpecificRule | null> => {
  const rowSpecificRuleResult = await db('repsk')
    .select('p1', 'p2', 'p3', 'p4', 'p5', 'hyrad.avitext as text')
    .innerJoin('repsr', 'repsk.keyrepsr', 'repsr.keyrepsr')
    .innerJoin('repst', 'repst.keydbtbl', 'repsk.keydbtbl')
    .innerJoin('hyrad', 'repsk.keycode', 'hyrad.keyhyrad')
    .innerJoin('cmart', 'cmart.keycmart', 'hyrad.keycmart')
    .innerJoin('hyobj', 'hyrad.keyhyobj', 'hyobj.keyhyobj')
    .where('repsk.year', '2025') // TODO: Use the year of the invoice row.
    .andWhere('keyrektk', 'INTAKT')
    .andWhere('repst.name', 'Hyresrad')
    .andWhere('hyobj.hyobjben', row.contractCode)
    .andWhere('cmart.code', row.rentArticle)

  let rowIndex = 0

  if (rowSpecificRuleResult.length > 1) {
    rowIndex = rowSpecificRuleResult.findIndex((resultRow) => {
      return (row.invoiceRowText as string).localeCompare(resultRow['text'])
    })

    if (rowIndex === -1) {
      logger.error(
        {
          rentArticle: row.rentArticle,
          contractCode: row.contractCode,
          invoiceNumber: row.invoiceNumber,
          invoiceRowText: row.invoiceRowText,
          rowSpecificRuleResult,
        },
        'Multiple results row specific accounting for article'
      )

      throw new Error(
        `Konteringsregler för hyresartikeln ${row.rentArticle} på faktura ${row.invoiceNumber} kunde inte hämtas (det finns flera uppsättningar konteringsregler för artikeln)`
      )
    }
  }

  if (rowSpecificRuleResult && rowSpecificRuleResult.length > 0) {
    return {
      costCode: rowSpecificRuleResult[rowIndex].p2?.toString().trimEnd(),
      property: rowSpecificRuleResult[rowIndex].p3?.toString().trimEnd(),
      projectCode: rowSpecificRuleResult[rowIndex].p4?.toString().trimEnd(),
      freeCode: rowSpecificRuleResult[rowIndex].p5?.toString().trimEnd(),
    }
  } else {
    logger.error(
      {
        contractCode: row.contractCode,
        rentArticle: row.rentArticle,
        invoiceRowText: row.invoiceRowText,
      },
      'No specific rule for invoice row'
    )
    return null
  }
}

const getAdditionalColumns = async (
  row: InvoiceDataRow,
  rentalSpecificRules: Record<string, Record<string, RentalSpecificRule>>
): Promise<{ row: InvoiceDataRow | undefined; error?: string | undefined }> => {
  const contractCode = row.contractCode as string
  const additionalColumns: InvoiceDataRow = {}

  if ('Öresutjämning' == row.invoiceRowText) {
    return {
      row: undefined,
    }
  }

  let specificRule: RentalSpecificRule | null | undefined = null

  // 001 = Mimer, 006 = Björnklockan
  if (row.company === '001' && contractCode) {
    specificRule =
      rentalSpecificRules[(row.fromDate as string).substring(0, 4)]?.[
        contractCode.split('/')[0]
      ]
    if (!specificRule) {
      logger.error(
        row,
        'Could not find cost code and property for normal rent row'
      )
      return {
        row: undefined,
        error: `Kunde inte hitta kostnadsställe och fastighet för hyresobjekt ${contractCode.split('/')[0]} på faktura ${row.invoiceNumber} med fråndatum ${row.fromDate}. Denna faktura måste bokföras manuellt i Xledger (både reskontra och intäktskonton)`,
      }
    }
  } else if (row.company === '006') {
    specificRule = await getRentalRowSpecificRule(row)
  }

  if (specificRule) {
    additionalColumns['costCode'] = specificRule['costCode']
    additionalColumns['property'] = specificRule['property']

    if (specificRule['projectCode']) {
      additionalColumns['projectCode'] = specificRule['projectCode']
    }

    if (specificRule['freeCode']) {
      additionalColumns['freeCode'] = specificRule['freeCode']
    }
  }

  return { row: additionalColumns }
}

/**
 * Adds invoice dates and accounting (cost code, property etc) from Xpand to
 * each invoice row. An invoice with any row that cannot be enriched is left
 * out entirely and reported in errors, so no invoice is exported partially.
 */
export const enrichInvoiceRows = async (
  invoiceDataRows: InvoiceDataRow[],
  invoices: Record<string, InvoiceRecord>
): Promise<{
  rows: InvoiceDataRow[]
  errors: { invoiceNumber: string; error: string }[]
}> => {
  const errors: { invoiceNumber: string; error: string }[] = []

  invoiceDataRows.forEach((row) => {
    const invoice = invoices[row.invoiceNumber]

    if (invoice) {
      row.invoiceDate = invoice.invdate as string
      row.invoiceFromDate = invoice.fromdate as string
      row.invoiceToDate = invoice.todate as string
      row.invoiceDueDate = invoice.expdate as string
    } else {
      // Invoice is not found in Xpand. A common reason is that it's an
      // invoice of the wrong type, for instance reminder.
      invoiceDataRows = invoiceDataRows.filter((filterRow) => {
        return !(filterRow.invoiceNumber as string).localeCompare(
          row.invoiceNumber as string
        )
      })
      logger.error(
        { invoiceNumber: row.invoiceNumber },
        'Invoice not found in XPand, removed invoice rows'
      )
      errors.push({
        invoiceNumber: row.invoiceNumber as string,
        error: 'Fakturans fakturaraderna kunde inte hämtas från Xpand',
      })
    }
  })

  const rentalIds = [
    ...new Set(
      invoiceDataRows.map((row) => row.contractCode.toString().split('/')[0])
    ),
  ]

  // Accounting rules are configured per year in Xpand, so fetch them for
  // every year an invoice row starts in.
  const years = [
    ...new Set(
      invoiceDataRows
        .map((row) => row.fromDate?.toString().substring(0, 4))
        .filter((year): year is string => Boolean(year))
    ),
  ]
  const rentalSpecificRules: Record<
    string,
    Record<string, RentalSpecificRule>
  > = {}
  for (const year of years) {
    rentalSpecificRules[year] = await getRentalSpecificRules(rentalIds, year)
  }

  const enrichedInvoiceRows = await Promise.all(
    invoiceDataRows.map(
      async (row: InvoiceDataRow): Promise<InvoiceDataRow | null> => {
        const additionalColumns = await getAdditionalColumns(
          row,
          rentalSpecificRules
        )

        if (!additionalColumns.row && additionalColumns.error) {
          logger.error(
            {
              invoiceNumber: row.invoiceNumber,
              error: additionalColumns.error,
            },
            'No additional columns'
          )
          errors.push({
            invoiceNumber: row.invoiceNumber as string,
            error:
              additionalColumns.error ??
              'Kunde inte hitta fastighet eller kostnadsställe för fakturan',
          })
          return null
        } else {
          return { ...row, ...additionalColumns.row }
        }
      }
    )
  )

  const errorInvoiceNumbers = new Set(errors.map((e) => e.invoiceNumber))
  const rows = enrichedInvoiceRows.filter(
    (row): row is InvoiceDataRow =>
      row !== null && !errorInvoiceNumbers.has(row.invoiceNumber as string)
  )

  return { rows, errors }
}

/**
 * Gets the numbers of all rental invoices for a company in Xpand with a
 * from date within the interval.
 */
export const getRentalInvoices = async (
  fromDate: Date,
  toDate: Date,
  companyId: string
): Promise<string[]> => {
  // Accounting rule codes for rent articles in Xpand. Björnklockan (006) also
  // has internal rent.
  const keycodes =
    companyId === '001' ? ['FADBT_HYRA'] : ['FADBT_INTHYRA', 'FADBT_HYRA']

  logger.info(
    { keycodes, companyId, fromDate, toDate },
    'Getting new invoices for company'
  )

  try {
    const rentalInvoiceNumbers: { invoice: string }[] = await db.raw(
      `select DISTINCT(invoice) from krfkh inner join krfkr on krfkr.keykrfkh = krfkh.keykrfkh
inner join cmcmp on krfkh.keycmcmp = cmcmp.keycmcmp
inner join cmart on cmart.code = krfkr.code
inner join cmarg on cmart.keycmarg = cmarg.keycmarg
inner Join repsk on cmart.keycmart = repsk.keycode
inner join repsr on repsk.keyrepsr = repsr.keyrepsr
where repsr.keycode IN (${placeholders(keycodes, ACCOUNTING_RULE_CODE_TYPE)})
and cmcmp.code = ?
and krfkh.fromdate >= ? AND krfkh.fromdate < ?
and not invoice is null
and not invoice like 'IH%'`,
      [...keycodes, companyId, fromDate, toDate]
    )

    // Xpand char codes are space padded
    return rentalInvoiceNumbers.map(({ invoice }) => invoice.trimEnd())
  } catch (err: unknown) {
    logger.error({ err }, 'xpand-rental-invoice-db-adapter.getRentalInvoices')
    throw err
  }
}

/**
 * Gets the total amount of the invoices in Xpand.
 */
export const getBatchTotalAmount = async (
  invoiceNumbers: string[]
): Promise<number> => {
  try {
    let total = 0

    for (const invoiceNumberChunk of chunk(invoiceNumbers, MAX_PARAMETERS)) {
      const result: { invoicesTotal: number | null }[] = await db.raw(
        `select SUM(
	case when krfkh.type = 2 then krfkh.amount + krfkh.vat + roundoff + krfkh.reduction
  when type = 1 then -(krfkh.amount + krfkh.vat + roundoff + krfkh.reduction) end)
	as invoicesTotal
	from krfkh
	where invoice in (${placeholders(invoiceNumberChunk, INVOICE_NUMBER_TYPE)})`,
        invoiceNumberChunk
      )

      total += result[0]?.invoicesTotal ?? 0
    }

    return total
  } catch (err: unknown) {
    logger.error({ err }, 'xpand-rental-invoice-db-adapter.getBatchTotalAmount')
    throw err
  }
}

type XpandInvoiceRowRecord = {
  type: number
  invoiceFromDate: Date
  invoiceToDate: Date
  invdate: Date
  expirationDate: Date
  invoice: string | null
  text: string | null
  printGroup: string | null
  printGroupLabel: string | null
  rentArticle: string | null
  company: string | null
  cmctckod: string | null
  cmctcben: string | null
  // Accounting from repsk: p1 = account, p4 = project code, p5 = free code
  p1: string | null
  p4: string | null
  p5: string | null
  rowAmount: number
  rowReduction: number
  rowVat: number
  roundoff: number
  rowtype: number
  invoiceTotal: number
}

const sumColumns = (...args: number[]) => {
  const sum = args.reduce((acc, arg) => acc + arg, 0)

  return Math.round((sum + Number.EPSILON) * 100) / 100
}

/**
 * Builds an invoice data row from columns, leaving out the ones that are null
 * in Xpand so they are stored as NULL in invoice_data.
 */
const toInvoiceDataRow = (
  columns: Record<string, string | number | null>
): InvoiceDataRow => {
  const row: InvoiceDataRow = {}

  Object.entries(columns).forEach(([key, value]) => {
    if (value !== null) {
      row[key] = typeof value === 'string' ? value.trimEnd() : value
    }
  })

  return row
}

/**
 * Gets the rows of the invoices from Xpand, ordered by invoice and print order.
 * Rows in a past month are moved to the current month, since accounting
 * cannot be booked on a closed period.
 */
export const getInvoiceRows = async (
  companyId: string,
  invoiceNumbers: string[]
): Promise<InvoiceDataRow[]> => {
  if (invoiceNumbers.length === 0) {
    return []
  }

  // Accounting rule code for rent articles in Xpand
  const keycode = 'FADBT_HYRA'

  try {
    const invoiceRows: XpandInvoiceRowRecord[] = []

    // Sorted so that the chunks keep the invoice order of the query
    const sortedInvoiceNumbers = [...invoiceNumbers].sort()

    for (const invoiceNumberChunk of chunk(
      sortedInvoiceNumbers,
      MAX_PARAMETERS
    )) {
      // Invoices starting with 5 or 8 can have rows with articles without
      // accounting rules that must still be included.
      const chunkRows: XpandInvoiceRowRecord[] = await db.raw(
        `
    SELECT
      cmart.code AS rentArticle,
      cmart.utskrgrupp AS printGroup,
      krfkr.printgroup AS printGroupLabel,
      krfkr.reduction AS rowReduction,
      krfkr.amount AS rowAmount,
      krfkr.vat AS rowVat,
      cmcmp.code AS company,
      krfkh.fromdate AS invoiceFromDate,
      krfkh.todate AS invoiceToDate,
      krfkh.expdate AS expirationDate,
      krfkh.amount + krfkh.vat + roundoff + krfkh.reduction AS invoiceTotal,
      *
    FROM krfkh
    INNER JOIN krfkr ON krfkr.keykrfkh = krfkh.keykrfkh
    INNER JOIN cmcmp ON krfkh.keycmcmp = cmcmp.keycmcmp
    INNER JOIN cmctc ON krfkh.keycmctc = cmctc.keycmctc
    LEFT JOIN cmart ON cmart.keycmart = krfkr.keycmart
    LEFT JOIN cmarg ON cmart.keycmarg = cmarg.keycmarg
    LEFT JOIN repsk ON cmart.keycmart = repsk.keycode
    LEFT JOIN repsr ON repsk.keyrepsr = repsr.keyrepsr
    WHERE
      (
        (repsr.keycode = CAST(? AS ${ACCOUNTING_RULE_CODE_TYPE}) AND keyrektk = 'INTAKT' AND repsk.year = datepart(year, krfkh.fromdate)) OR
        (krfkh.invoice like '5%' and (repsr.keycode is null and keyrektk is null and repsk.year is null)) or
        (krfkh.invoice like '8%' and ((repsr.keycode is null and keyrektk = 'INTAKT' and repsk.year = datepart(year, krfkh.fromdate)) or (repsr.keycode is null and keyrektk is null and repsk.year is null)))
      )
      AND cmcmp.code = ?
      AND (krfkh.type = 1 OR krfkh.type = 2)
      AND invoice IN (${placeholders(invoiceNumberChunk, INVOICE_NUMBER_TYPE)})
    ORDER BY invoice ASC, krfkr.printsort ASC
    `,
        [keycode, companyId, ...invoiceNumberChunk]
      )

      invoiceRows.push(...chunkRows)
    }

    logger.info(
      {
        includedRows: invoiceRows.length,
        includedInvoices: new Set(invoiceRows.map((row) => row.invoice)).size,
        requestedInvoices: invoiceNumbers.length,
      },
      'Retrieved invoices'
    )

    // Derive "current month" strings in UTC so they share the same calendar as
    // xledgerDateString (which uses toISOString → UTC). Comparing in any other
    // timezone risks a row being rewritten to a different month than the one
    // its formatted date string ends up in around month boundaries.
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const y = now.getUTCFullYear()
    const m = pad(now.getUTCMonth() + 1)
    const lastDay = pad(
      new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)
      ).getUTCDate()
    )
    const startOfCurrentMonthString = `${y}${m}01`
    const endOfCurrentMonthString = `${y}${m}${lastDay}`

    return invoiceRows.map((invoiceRow): InvoiceDataRow => {
      const invoiceFromDateString = xledgerDateString(
        invoiceRow.invoiceFromDate
      )
      const fromDateString =
        invoiceFromDateString < startOfCurrentMonthString
          ? startOfCurrentMonthString
          : invoiceFromDateString

      const invoiceToDateString = xledgerDateString(invoiceRow.invoiceToDate)
      const toDateString =
        invoiceToDateString < startOfCurrentMonthString
          ? endOfCurrentMonthString
          : invoiceToDateString

      // Type 2 = credit invoice, reverse signs
      const sign = invoiceRow.type === 2 ? -1 : 1

      return toInvoiceDataRow({
        account: invoiceRow.p1,
        amount: sign * sumColumns(invoiceRow.rowAmount),
        company: invoiceRow.company,
        contactCode: invoiceRow.cmctckod,
        deduction: sign * sumColumns(invoiceRow.rowReduction),
        freeCode: invoiceRow.p5,
        fromDate: fromDateString,
        invoiceDate: xledgerDateString(invoiceRow.invdate),
        invoiceDueDate: xledgerDateString(invoiceRow.expirationDate),
        invoiceNumber: invoiceRow.invoice,
        invoiceRowText: invoiceRow.text,
        invoiceTotalAmount: sign * sumColumns(invoiceRow.invoiceTotal),
        printGroup: invoiceRow.printGroup,
        printGroupLabel: invoiceRow.printGroupLabel,
        projectCode: invoiceRow.p4,
        rentArticle: invoiceRow.rentArticle,
        roundoff: sign * sumColumns(invoiceRow.roundoff),
        rowType: sumColumns(invoiceRow.rowtype),
        tenantName: invoiceRow.cmctcben,
        toDate: toDateString,
        totalAmount:
          sign *
          sumColumns(
            invoiceRow.rowAmount,
            invoiceRow.rowReduction,
            invoiceRow.rowVat
          ),
        vat: sign * sumColumns(invoiceRow.rowVat),
      })
    })
  } catch (err: unknown) {
    logger.error({ err }, 'xpand-rental-invoice-db-adapter.getInvoiceRows')
    throw err
  }
}
