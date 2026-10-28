import knex from 'knex'
import { RentInvoiceRow } from '@onecore/types'

import config from '../../../common/config'
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
