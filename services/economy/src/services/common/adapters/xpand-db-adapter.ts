import knex from 'knex'
import { RentInvoiceRow } from '@onecore/types'
import { logger } from '@onecore/utilities'

import config from '../../../common/config'
import { AdapterResult } from '../../../common/types'
import trimStrings from '../../../utils/trimStrings'

const db = knex({
  connection: {
    host: config.xpandDatabase.host,
    user: config.xpandDatabase.user,
    password: config.xpandDatabase.password,
    port: config.xpandDatabase.port,
    database: config.xpandDatabase.database,
    requestTimeout: 30000,
  },
  pool: {
    min: 0,
    idleTimeoutMillis: 5000,
  },
  client: 'mssql',
})

type XpandInvoiceRow = {
  invoiceNumber: string
  text: string
  amount: number
  reduction: number
  vat: number
  code: string
  rowType: number
  printGroup: string | null
  invoiceRowType: string
  rentType: string | null
  fromDate: Date
  toDate: Date
}

export const getInvoiceRows = async (
  invoiceNumbers: string[]
): Promise<RentInvoiceRow[]> => {
  const invoiceRows = await db
    .select(
      'krfkh.invoice AS invoiceNumber',
      'krfkr.text',
      'krfkr.amount',
      'krfkr.reduction',
      'krfkr.vat',
      'krfkr.code',
      'krfkr.rowtype AS rowType',
      'krfkr.printgroup AS printGroup',
      'krfkr.fromdate AS fromDate',
      'krfkr.todate AS toDate',
      'cmarg.caption AS invoiceRowType',
      'hysum.hysumben AS rentType'
    )
    .from('krfkh')
    .innerJoin('krfkr', 'krfkh.keykrfkh', 'krfkr.keykrfkh')
    .leftJoin('cmart', 'krfkr.keycmart', 'cmart.keycmart')
    .leftJoin('cmarg', 'cmart.keycmarg', 'cmarg.keycmarg')
    .leftJoin('hysum', 'cmart.keyhysum', 'hysum.keyhysum')
    .whereRaw(
      `krfkh.invoice IN (${invoiceNumbers.map((n) => `'${n}'`).join(', ')})`
    )
    .whereNotNull('krfkh.fromdate')
    .orderBy('krfkr.printsort', 'asc')
    .then(trimStrings<XpandInvoiceRow[]>)

  return invoiceRows.map((row): RentInvoiceRow => {
    return {
      invoiceNumber: row.invoiceNumber,
      text: row.text,
      amount: row.amount,
      reduction: row.reduction,
      vat: row.vat,
      type: row.invoiceRowType === 'Hyra/Inkasso' ? 'Rent' : 'Other',
      rentType: row.code === 'HEMFÖR' ? 'Hemförsäkring' : row.rentType,
      code: row.code,
      rowType: row.rowType,
      printGroup: row.printGroup,
      fromDate: new Date(row.fromDate),
      toDate: new Date(row.toDate),
    }
  })
}

export const mapContactFlags = (row: {
  protectedIdentity: unknown
  deceased: unknown
  emigrated: unknown
  noAdvertising: unknown
}) => ({
  protectedIdentity: row.protectedIdentity !== null,
  deceased: row.deceased !== null,
  emigrated: row.emigrated !== null,
  noAdvertising: row.noAdvertising == null ? false : row.noAdvertising !== 0,
})

export const getPropertyCodeAndCostCentreForLease = async (
  rentalId: string,
  year?: number
): Promise<{ costCentre: string; propertyCode: string } | null> => {
  const queries = [
    // First try: join via babyg when keyobjbyg exists
    db
      .select('repsk.p2 AS costCentre', 'repsk.p3 AS propertyCode')
      .from('babuf')
      .innerJoin('babyg', 'babyg.keycmobj', 'babuf.keyobjbyg')
      .innerJoin('repsk', 'repsk.keycode', 'babyg.keybabyg')
      .where('babuf.hyresid', rentalId)
      .whereNotNull('babuf.keyobjbyg')
      .orderBy('repsk.year', 'desc')
      .limit(1),

    // Second try: join via keyobjyta when keyobjbyg is null
    db
      .select('repsk.p2 AS costCentre', 'repsk.p3 AS propertyCode')
      .from('babuf')
      .innerJoin('repsk', 'repsk.keycode', 'babuf.keyobjyta')
      .where('babuf.hyresid', rentalId)
      .whereNull('babuf.keyobjbyg')
      .whereNotNull('babuf.keyobjyta')
      .orderBy('repsk.year', 'desc')
      .limit(1),

    // Third try: join via fstcode as fallback
    db
      .select('repsk.p2 AS costCentre', 'repsk.p3 AS propertyCode')
      .from('babuf')
      .innerJoin('repsk', 'repsk.p3', 'babuf.fstcode')
      .where('babuf.hyresid', rentalId)
      .whereNotNull('babuf.fstcode')
      .orderBy('repsk.year', 'desc')
      .limit(1),
  ]

  for (const query of queries) {
    if (year) {
      query.where('repsk.year', year)
    }

    const result = await query.then(trimStrings)

    if (result.length > 0) {
      return {
        costCentre: result[0].costCentre ?? '',
        propertyCode: result[0].propertyCode ?? '',
      }
    }
  }

  return null
}

// Codes per query. Each one is a bound parameter, and SQL Server takes at
// most 2100, and a VALUES list at most 1000 rows.
const COST_CENTRE_CHUNK_SIZE = 1000

// Rental object codes are far shorter. A longer one can't be in babuf, and
// CAST would cut it to a code that might be.
const MAX_RENTAL_OBJECT_CODE_LENGTH = 30

// Xpand compares codes ignoring case and trailing blanks, so key the result
// the same way.
export const rentalObjectCodeKey = (code: string): string =>
  code.trim().toUpperCase()

/**
 * The cost centre of each rental object, keyed by rentalObjectCodeKey. The
 * same lookups as getPropertyCodeAndCostCentreForLease, for many objects in
 * one query per 1000 codes: through the building when the object has one,
 * else through its area, else through its property, the latest year first.
 * An object with no cost centre is left out.
 */
export const getCostCentresByRentalObjectCodes = async (
  rentalObjectCodes: string[]
): Promise<AdapterResult<Map<string, string>, 'unknown'>> => {
  const codes = [
    ...new Set(
      rentalObjectCodes
        .map((code) => code.trim())
        .filter(
          (code) =>
            code.length > 0 && code.length <= MAX_RENTAL_OBJECT_CODE_LENGTH
        )
    ),
  ]

  try {
    const costCentres = new Map<string, string>()

    for (let i = 0; i < codes.length; i += COST_CENTRE_CHUNK_SIZE) {
      const chunk = codes.slice(i, i + COST_CENTRE_CHUNK_SIZE)
      // Only placeholders are put into the SQL, never a code. CAST to
      // VARCHAR, since knex sends strings as NVARCHAR and babuf.hyresid is
      // VARCHAR: comparing the two makes SQL Server scan the whole table.
      const values = chunk
        .map(() => `(CAST(? AS VARCHAR(${MAX_RENTAL_OBJECT_CODE_LENGTH})))`)
        .join(', ')

      const rows: { rentalObjectCode: string; costCentre: string | null }[] =
        await db
          .raw(
            `
            WITH codes (code) AS (SELECT code FROM (VALUES ${values}) AS v (code)),
            candidates AS (
              SELECT babuf.hyresid, repsk.p2 AS costCentre, repsk.year, 1 AS priority
              FROM babuf
              INNER JOIN codes ON codes.code = babuf.hyresid
              INNER JOIN babyg ON babyg.keycmobj = babuf.keyobjbyg
              INNER JOIN repsk ON repsk.keycode = babyg.keybabyg
              WHERE babuf.keyobjbyg IS NOT NULL
              UNION ALL
              SELECT babuf.hyresid, repsk.p2, repsk.year, 2
              FROM babuf
              INNER JOIN codes ON codes.code = babuf.hyresid
              INNER JOIN repsk ON repsk.keycode = babuf.keyobjyta
              WHERE babuf.keyobjbyg IS NULL AND babuf.keyobjyta IS NOT NULL
              UNION ALL
              SELECT babuf.hyresid, repsk.p2, repsk.year, 3
              FROM babuf
              INNER JOIN codes ON codes.code = babuf.hyresid
              INNER JOIN repsk ON repsk.p3 = babuf.fstcode
              WHERE babuf.fstcode IS NOT NULL
            ),
            ranked AS (
              SELECT hyresid, costCentre,
                ROW_NUMBER() OVER (PARTITION BY hyresid ORDER BY priority, year DESC) AS rowNumber
              FROM candidates
            )
            SELECT hyresid AS rentalObjectCode, costCentre
            FROM ranked
            WHERE rowNumber = 1
            `,
            chunk
          )
          .then(trimStrings)

      for (const row of rows) {
        if (row.rentalObjectCode && row.costCentre) {
          costCentres.set(
            rentalObjectCodeKey(row.rentalObjectCode),
            row.costCentre
          )
        }
      }
    }

    return { ok: true, data: costCentres }
  } catch (err: unknown) {
    logger.error(
      { err, codeCount: codes.length },
      'xpand-db-adapter.getCostCentresByRentalObjectCodes'
    )
    return { ok: false, err: 'unknown' }
  }
}
