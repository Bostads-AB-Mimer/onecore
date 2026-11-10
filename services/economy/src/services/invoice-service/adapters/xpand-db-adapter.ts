import knex from 'knex'
import {
  Address,
  Invoice,
  InvoiceRow,
  InvoiceTransactionType,
  invoiceTransactionTypeTranslation,
  paymentStatusTranslation,
} from '@onecore/types'
import { logger } from '@onecore/utilities'

import config, { isRentalObjectRequirementException } from '@src/common/config'
import {
  InvoiceDeliveryMethod,
  XpandContact,
  xledgerDateString,
} from '@src/common/types'
import { mapContactFlags } from '@src/services/common/adapters/xpand-db-adapter'
import {
  InvoiceRowWithAccounting,
  InvoiceWithAccounting,
  RentalBlockWithAccounting,
} from '@src/common/types/typesv2'

type RentalSpecificRule = {
  costCode: string
  property: string
  projectCode?: string
  freeCode?: string
}

type RentalSpecificRules = Record<string, RentalSpecificRule>

export type RoundOffInformation = {
  account: string
  costCode: string | undefined
}

export class RoundOffInformationNotFoundError extends Error {
  readonly code = 'round-off-information-not-found'

  constructor(readonly year: string) {
    // Swedish: the message is shown to economy staff in the export report.
    super(`Konto för öresutjämning (ORESUTJ) saknas i Xpand för år ${year}`)
    this.name = 'RoundOffInformationNotFoundError'
  }
}

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

/*
 * A separate client for the invoice list (customer card, Mina sidor, credit
 * check), which treats Xpand as best-effort. Its short request timeout makes
 * the driver cancel a slow query and return the connection, and its own small
 * pool means a hung Xpand can't take the connections the export and contact
 * lookups above need.
 */
export const INVOICE_LIST_REQUEST_TIMEOUT_MS = 10_000

const invoiceListDb = knex({
  connection: {
    host: config.xpandDatabase.host,
    user: config.xpandDatabase.user,
    password: config.xpandDatabase.password,
    port: config.xpandDatabase.port,
    database: config.xpandDatabase.database,
    requestTimeout: INVOICE_LIST_REQUEST_TIMEOUT_MS,
  },
  pool: { min: 0, max: 5 },
  acquireConnectionTimeout: INVOICE_LIST_REQUEST_TIMEOUT_MS,
  client: 'mssql',
})

export const closeDb = () => {
  db.destroy()
  invoiceListDb.destroy()
}

export const enrichInvoiceWithAccounting = async (
  invoice: InvoiceWithAccounting
): Promise<InvoiceWithAccounting> => {
  const year = invoice.invoiceDate.getFullYear()
  const rentalIds = invoice.invoiceRows
    .map((invoiceRow: InvoiceRowWithAccounting) => invoiceRow.rentalObject)
    .filter((rentalObject): rentalObject is string => Boolean(rentalObject))
  const rentalSpecificRules = await getRentalSpecificRules(
    rentalIds,
    year.toString()
  )

  for (const invoiceRow of invoice.invoiceRows) {
    // Rows exempt from the rental object requirement (e.g. invoice fees) have
    // no rental object and therefore no rental-specific accounting rules to
    // apply. Their accounting is resolved from the article configuration.
    if (!invoiceRow.rentalObject) {
      if (isRentalObjectRequirementException(invoiceRow.rentArticleName)) {
        continue
      }

      logger.error(
        { invoiceNumber: invoice.invoiceId },
        'Invoice row is missing a rental object'
      )
      throw new Error(
        `Minst en hyresrad på avin ${invoice.invoiceId} saknar hyresobjekt`
      )
    }

    const rentalSpecificRule = rentalSpecificRules[invoiceRow.rentalObject]
    if (!rentalSpecificRule || Object.keys(rentalSpecificRule).length === 0) {
      logger.error(
        {
          invoiceNumber: invoice.invoiceId,
          rentalSpecificRules,
          rentalObject: invoiceRow.rentalObject,
        },
        'Could not get accounting rules for invoice from Xpand'
      )
      throw new Error(
        `Kunde inte hitta konteringsregler för hyresobjektet ${invoiceRow.rentalObject} på faktura ${invoice.invoiceId}`
      )
    }
    invoiceRow.projectCode =
      invoiceRow.projectCode ?? rentalSpecificRule?.projectCode
    invoiceRow.costCode = invoiceRow.costCode ?? rentalSpecificRule?.costCode
    invoiceRow.property = invoiceRow.property ?? rentalSpecificRule?.property
    invoiceRow.freeCode = invoiceRow.freeCode ?? rentalSpecificRule?.freeCode
  }

  return invoice
}

// The ORESUTJ account and cost code are configured per year in Xpand.
const roundOffInformationByYear = new Map<string, RoundOffInformation>()

export const getRoundOffInformation = async (
  year: string
): Promise<RoundOffInformation> => {
  const cached = roundOffInformationByYear.get(year)
  if (cached) {
    return cached
  }

  const rows = await db('repsk')
    .where('keycode', 'ORESUTJ')
    .andWhere('year', year)
    .distinct()

  const account = rows[0]?.['p1']?.toString().trimEnd()
  if (!account) {
    logger.warn({ year }, 'Round off information not found')
    throw new RoundOffInformationNotFoundError(year)
  }

  const roundOffInformation: RoundOffInformation = {
    account,
    costCode: rows[0]['p2']?.toString().trimEnd(),
  }
  roundOffInformationByYear.set(year, roundOffInformation)
  return roundOffInformation
}

export const getRentalSpecificRules = async (
  rentalIds: string[],
  year: string
) => {
  const specificRules: RentalSpecificRules = {}

  // SQL Server tillåter max ~2100 parametrar per fråga, så hyresid-listan
  // måste köras i bitar.
  const chunkSize = 1000
  const chunks: string[][] = []
  for (let i = 0; i < rentalIds.length; i += chunkSize) {
    chunks.push(rentalIds.slice(i, i + chunkSize))
  }

  for (const chunk of chunks) {
    const specificRulesBuildingsQuery = db('repsk')
      .innerJoin('babyg', 'babyg.keybabyg', 'repsk.keycode')
      .innerJoin('babuf', 'babyg.keycmobj', 'babuf.keyobjbyg')
      .where('year', year)
      .andWhereLike('keyrektk', 'INTAKT%')
      .whereIn('hyresid', chunk)
      .distinct()

    const specificRulesBuildings = await specificRulesBuildingsQuery

    specificRulesBuildings.forEach((row) => {
      specificRules[row['hyresid'].toString().trimEnd()] = {
        costCode: row['p2'].toString().trimEnd(),
        property: row['p3'].toString().trimEnd(),
      }
    })

    const specificRulesAreasQuery = db('repsk')
      .innerJoin('bayta', 'bayta.keybayta', 'repsk.keycode')
      .innerJoin('babuf', 'bayta.keycmobj', 'babuf.keyobjyta')
      .where('year', year)
      .andWhereLike('keyrektk', 'INTAKT%')
      .whereIn('hyresid', chunk)
      .distinct()

    const specificRulesAreas = await specificRulesAreasQuery

    specificRulesAreas.forEach((row) => {
      specificRules[row['hyresid'].toString().trimEnd()] = {
        costCode: row['p2']?.toString().trimEnd(),
        property: row['p3']?.toString().trimEnd(),
      }
    })
  }

  return specificRules
}

export const getContacts = async (
  contactCodes: string[]
): Promise<XpandContact[]> => {
  const contactQuery = db
    .from('cmctc')
    .select(
      'cmctc.cmctckod as contactCode',
      'cmctc.fnamn as firstName',
      'cmctc.enamn as lastName',
      'cmctc.cmctcben as fullName',
      'cmctc.persorgnr as nationalRegistrationNumber',
      'cmctc.birthdate as birthDate',
      'cmctc.keycmobj as keycmobj',
      'cmctc.keycmctc as contactKey',
      'cmctc.lagsokt as protectedIdentity',
      'krknr.autogiro as autogiro',
      'krknr.stopdate as autogiroCancelledAt',
      'cmctc.avliden as deceased',
      'cmctc.konkurs as emigrated',
      'cmctc.blockinfo as noAdvertising'
    )
    .leftJoin('krknr', 'cmctc.keycmctc', 'krknr.keycmctc')

  const rows = await contactQuery
    .distinct()
    .whereIn('cmctc.cmctckod', contactCodes)

  const emailAddresses = await db('cmeml')
    .select('cmemlben', 'cmctckod')
    .innerJoin('cmctc', 'cmeml.keycmobj', 'cmctc.keycmobj')
    .whereIn('cmctckod', contactCodes)
    .orderBy('main', 'desc')

  const invoiceAddresses = await db('cmadr')
    .select('cmctckod', 'adress1', 'adress3', 'adress4')
    .innerJoin('cmctc', 'cmadr.keycode', 'cmctc.keycmobj')
    .whereIn('cmctckod', contactCodes)
    .orderBy('cmctckod', 'asc')
    .orderBy('fdate', 'desc')
    .orderBy('tdate', 'desc')

  const getContactEmail = (contactCode: string): string => {
    const emailAddress = emailAddresses.find((emailAddress) => {
      return (
        emailAddress['cmctckod'] &&
        emailAddress['cmctckod'].localeCompare(contactCode) === 0
      )
    })

    return emailAddress?.cmemlben ? emailAddress.cmemlben?.trimEnd() : ''
  }

  const getContactAddress = (contactCode: string): Address => {
    const invoiceAddress = invoiceAddresses.find((invoiceAddress) => {
      return (
        invoiceAddress['cmctckod'] &&
        invoiceAddress['cmctckod'].localeCompare(contactCode) === 0
      )
    })

    if (invoiceAddress) {
      return {
        street: invoiceAddress.adress1?.trimEnd(),
        postalCode: invoiceAddress.adress3?.trimEnd(),
        city: invoiceAddress.adress4?.trimEnd(),
        number: '',
      }
    } else {
      return {
        street: '',
        postalCode: '',
        number: '',
        city: '',
      }
    }
  }

  const contacts = rows.map((contactRow) => {
    let nationalRegistrationNumber =
      contactRow.nationalRegistrationNumber?.trimEnd()

    if (nationalRegistrationNumber) {
      if (nationalRegistrationNumber.length > 11) {
        nationalRegistrationNumber = nationalRegistrationNumber.substring(2)
      }

      nationalRegistrationNumber =
        nationalRegistrationNumber.substring(
          0,
          nationalRegistrationNumber.length - 4
        ) +
        '-' +
        nationalRegistrationNumber.substring(
          nationalRegistrationNumber.length - 4
        )
    }

    const contactCode = contactRow.contactCode?.trimEnd()
    const emailAddress = getContactEmail(contactCode)

    const { protectedIdentity, deceased, emigrated, noAdvertising } =
      mapContactFlags(contactRow)

    return {
      contactCode: contactRow.contactCode?.trimEnd(),
      contactKey: contactRow.contactKey?.trimEnd(),
      firstName: contactRow.firstName?.trimEnd(),
      lastName: contactRow.lastName?.trimEnd(),
      fullName: contactRow.fullName?.trimEnd(),
      nationalRegistrationNumber,
      birthDate: contactRow.birthDate,
      isTenant: true,
      address: getContactAddress(contactCode),
      phoneNumbers: undefined,
      emailAddress: emailAddress,
      autogiro:
        contactRow.autogiro &&
        contactRow.autogiro !== 0 &&
        contactRow.autogiroCancelledAt === null,
      invoiceDeliveryMethod:
        emailAddress !== ''
          ? InvoiceDeliveryMethod.Email
          : InvoiceDeliveryMethod.Other,
      protectedIdentity,
      deceased,
      emigrated,
      noAdvertising,
    }
  })

  return contacts
}

// Xpand stores unset posting columns as blank padded strings. Map them to
// undefined so the rental object's own rules can fill them in later.
const blankToUndefined = (value: unknown): string | undefined => {
  const trimmed = value?.toString().trim()
  return trimmed ? trimmed : undefined
}

const transformRentalBlockWithAccounting = (
  dbRow: any
): RentalBlockWithAccounting => {
  return {
    account: dbRow.p1.trim(),
    costCode: blankToUndefined(dbRow.p2),
    property: blankToUndefined(dbRow.p3),
    projectCode: blankToUndefined(dbRow.p4),
    freeCode: blankToUndefined(dbRow.p5),
    description: dbRow.caption?.toString().trimEnd(),
    fromDate: dbRow.fromDate,
    toDate: dbRow.toDate,
  }
}

/**
 * Returns an active rental block with accounting information for a given rental object, if the
 * block is active within the date range and has accounting information. Rental blocks without
 * accounting information are not returned even if they are active within the date range.
 * A block is active if it overlaps the date range on at least one day, so blocks that start
 * or end inside the range are included. The caller truncates them to the range.
 * Only the cost (INKOP) accounting of the block is used. Some blocks also have income (INTAKT)
 * accounting, which would otherwise be returned as a second block with the same dates.
 */
export const getActiveRentalBlocksWithAccounting = async (
  rentalId: string,
  from: Date,
  to: Date
) => {
  const year = from.toISOString().substring(0, 4)

  const blockWithAccounting = await db.raw(
    `select p1, p2, p3, p4, p5, hyspt.fdate as fromDate, hyspt.tdate as toDate, hyspa.caption as caption from hyspt 
  inner join hyspa on hyspt.keyhyspa = hyspa.keyhyspa
  inner join repsk on hyspa.keyhyspa = repsk.keycode
  inner join babuf ON hyspt.keycmobj = babuf.keycmobj
  inner join cmobj on hyspt.keycmobj = cmobj.keycmobj
  where babuf.hyresid = ?
  and hyspt.fdate <= ?
  and (hyspt.tdate >= ? or hyspt.tdate is null)
  and repsk.year = ?
  and repsk.keyrektk = 'INKOP'`,
    [rentalId, to, from, year]
  )

  return blockWithAccounting.map(transformRentalBlockWithAccounting)
}

// SQL Server allows at most 2100 bind parameters per query, so long id lists
// are queried in chunks.
const XPAND_QUERY_CHUNK_SIZE = 500

const chunked = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

// Columns selected by buildInvoicesByContactCodeQuery.
type XpandInvoiceDbRow = {
  invoiceId: string | null
  leaseId: string | null
  amount: number
  reduction: number
  vat: number
  roundoff: number
  fromDate: Date
  toDate: Date
  invoiceDate: Date
  expirationDate: Date | null
  debitStatus: number
  paymentStatus: number
  transactionType: string | null
  transactionTypeName: string
  recipientContactCode: string | null
  invoiceRowKey: string | null
}

// krfkh.debstatus for an invoice that has been deleted (makulerad).
const DEBIT_STATUS_DELETED = 6

const getTransactionType = (
  transactionTypeKey: string | null
): InvoiceTransactionType =>
  (transactionTypeKey &&
    invoiceTransactionTypeTranslation[transactionTypeKey.trimEnd()]) ||
  InvoiceTransactionType.Other

const transformFromDbInvoice = (
  row: XpandInvoiceDbRow & { invoiceId: string },
  contactCode: string
): Invoice => {
  const amount = row.amount + row.reduction + row.vat + row.roundoff
  const leaseId = row.leaseId?.trim()

  return {
    // The invoice's actual paying contact — for invoices found via a shared
    // lease this is the other holder, not the contact the lookup was made
    // for. Matches the Xledger transform, where reference is the subledger
    // (customer) code.
    reference: row.recipientContactCode
      ? row.recipientContactCode.trimEnd()
      : contactCode,
    invoiceId: row.invoiceId.trim(),
    leaseIds: leaseId ? [leaseId] : [],
    amount: Math.round((amount + Number.EPSILON) * 100) / 100,
    fromDate: row.fromDate,
    toDate: row.toDate,
    invoiceDate: row.invoiceDate,
    expirationDate: row.expirationDate ?? undefined,
    debitStatus: row.debitStatus,
    paymentStatus: paymentStatusTranslation[row.paymentStatus],
    transactionType: getTransactionType(row.transactionType),
    transactionTypeName: row.transactionTypeName.trim(),
    type: 'Regular',
    source: 'legacy',
    invoiceRows: [],
    // Xpand does not mark credit invoices by number. Before the Tenfast
    // release this was derived from a column the query never selected, so it
    // was always null.
    credit: null,
  }
}

const buildInvoicesByContactCodeQuery = (filters?: { from?: Date }) => {
  let query = invoiceListDb
    .select(
      'krfkh.invoice as invoiceId',
      'krfkh.reference as leaseId',
      'krfkh.amount as amount',
      'krfkh.fromdate as fromDate',
      'krfkh.todate as toDate',
      'krfkh.reduction',
      'krfkh.vat',
      'krfkh.roundoff',
      'krfkh.invdate as invoiceDate',
      'krfkh.expdate as expirationDate',
      'krfkh.debstatus as debitStatus',
      'krfkh.paystatus as paymentStatus',
      'krfkh.keyrevrt as transactionType',
      'revrt.name as transactionTypeName',
      'cmctc.cmctckod as recipientContactCode',
      'krfkh.keykrfkh as invoiceRowKey'
    )
    .from('krfkh')
    .innerJoin('cmctc', 'cmctc.keycmctc', 'krfkh.keycmctc')
    .innerJoin('revrt', 'revrt.keyrevrt', 'krfkh.keyrevrt')
    .whereIn('krfkh.type', [1, 2])
    .orderBy('krfkh.fromdate', 'desc')

  if (filters?.from) {
    query = query.andWhere('krfkh.fromdate', '>=', filters.from)
  }

  return query
}

/*
 * Leases where the contact is a (co-)holder. Invoices in krfkh are bound to
 * a single paying contact (keycmctc), so a co-holder on a shared lease has no
 * invoices of their own — their household's invoices must be looked up via
 * the leases they hold (MIM-1160). Only INNEHAVARE relations count, mirroring
 * isLeaseHolderRelation in the leasing service — other relation types (e.g.
 * guarantors) must not expose invoices.
 *
 * Terminated leases are excluded, using the leasing service's rule
 * (isLeaseTerminated: last debit date or termination date has passed): hyavk
 * rows survive termination, and a former co-holder must not keep seeing
 * invoices issued to whoever remains on the contract. Upcoming leases are
 * kept — their advance invoices are relevant to both holders.
 */
const getHolderLeaseIds = async (contactCode: string): Promise<string[]> => {
  try {
    const rows: {
      leaseId: string | null
      lastDebitDate: Date | null
      terminationDate: Date | null
    }[] = await invoiceListDb
      .from('hyavk')
      .select(
        'hyobj.hyobjben as leaseId',
        'hyobj.sistadeb as lastDebitDate',
        'hyobj.makuldatum as terminationDate'
      )
      .innerJoin('cmctc', 'cmctc.keycmctc', 'hyavk.keycmctc')
      .innerJoin('hyobj', 'hyobj.keyhyobj', 'hyavk.keyhyobj')
      .where('cmctc.cmctckod', contactCode)
      .where('hyavk.keyhyakt', 'INNEHAVARE')

    // Compared on calendar dates, like the leasing service does.
    const toIsoDate = (date: Date) => date.toISOString().split('T')[0]
    const today = toIsoDate(new Date())
    const hasPassed = (date: Date | null | undefined) =>
      date != null && toIsoDate(new Date(date)) < today

    return rows
      .filter(
        (row) =>
          !hasPassed(row.lastDebitDate) && !hasPassed(row.terminationDate)
      )
      .map((row) => row.leaseId?.trimEnd())
      .filter((leaseId): leaseId is string => Boolean(leaseId))
  } catch (err: unknown) {
    // Degrade to recipient-only invoices rather than failing the whole
    // invoice lookup for every contact.
    logger.error({ err }, 'adapter.getHolderLeaseIds')
    return []
  }
}

/*
 * Invoices in Xpand for a contact: those billed to the contact, plus those on
 * leases the contact holds together with someone else (MIM-1160).
 */
export const getInvoicesByContactCode = async (
  contactCode: string,
  filters?: { from?: Date }
): Promise<Invoice[] | undefined> => {
  try {
    logger.info(
      { contactCode },
      'Getting invoices by contact code from Xpand DB'
    )

    const [recipientRows, holderLeaseIds]: [XpandInvoiceDbRow[], string[]] =
      await Promise.all([
        buildInvoicesByContactCodeQuery(filters).where({
          'cmctc.cmctckod': contactCode,
        }),
        getHolderLeaseIds(contactCode),
      ])

    // An organisation contact can hold a very large number of lease objects.
    const leaseRows: XpandInvoiceDbRow[] = []
    for (const leaseIds of chunked(holderLeaseIds, XPAND_QUERY_CHUNK_SIZE)) {
      const chunkRows: XpandInvoiceDbRow[] =
        await buildInvoicesByContactCodeQuery(filters).whereIn(
          'krfkh.reference',
          leaseIds
        )
      leaseRows.push(...chunkRows)
    }

    // Merge both lookups, dropping duplicate rows (an invoice where the
    // contact is both recipient and lease holder is returned by both
    // queries). Keyed on krfkh's primary key — invoice numbers are not
    // guaranteed unique, so two distinct rows sharing a number must both
    // survive.
    const seenRowKeys = new Set<string>()
    const rows: XpandInvoiceDbRow[] = []
    for (const row of [...recipientRows, ...leaseRows]) {
      const rowKey = row.invoiceRowKey?.trimEnd()
      if (rowKey) {
        if (seenRowKeys.has(rowKey)) {
          continue
        }
        seenRowKeys.add(rowKey)
      }
      rows.push(row)
    }

    rows.sort(
      (a, b) => new Date(b.fromDate).getTime() - new Date(a.fromDate).getTime()
    )

    if (rows.length === 0) {
      return undefined
    }

    const invoices = rows
      .filter(
        (row): row is XpandInvoiceDbRow & { invoiceId: string } =>
          Boolean(row.invoiceId) && row.debitStatus !== DEBIT_STATUS_DELETED
      )
      .map((row) => transformFromDbInvoice(row, contactCode))

    logger.info(
      { contactCode },
      'Getting invoices by contact code from Xpand DB completed'
    )
    return invoices
  } catch (err: unknown) {
    logger.error({ err, contactCode }, 'adapter.getInvoicesByContactCode')
    throw err
  }
}

// Columns read from the getInvoiceRows query.
type XpandInvoiceRowDbRow = {
  type: number
  invoice: string
  invdate: Date
  invoiceFromDate: Date
  invoiceToDate: Date
  expirationDate: Date
  text: string | null
  rentArticle: string | null
  printGroup: string | null
  rowAmount: number
  rowReduction: number
  rowVat: number
  roundoff: number
  rowtype: number
}

/*
 * Invoice rows from Xpand for the invoices shown in a customer's invoice list.
 * Written for the former Xpand accounting export, which is why it filters on
 * the revenue rules (FADBT_HYRA); kept so the rows are the same as before the
 * Tenfast release. Unlike the export, rows keep their invoice's period.
 */
export const getInvoiceRows = async (
  companyId: string,
  invoiceNumbers: string[]
): Promise<InvoiceRow[]> => {
  if (invoiceNumbers.length === 0) {
    return []
  }

  const keycodes = ['FADBT_HYRA']

  // knex binds strings as nvarchar. krfkh.invoice is varchar(25), and comparing
  // it with nvarchar makes SQL Server convert the column and scan the whole
  // table (~20 s for a customer with a long history, instead of well under a
  // second). Casting the parameters keeps the index usable.

  try {
    const invoiceRows: XpandInvoiceRowDbRow[] = []
    for (const chunk of chunked(invoiceNumbers, XPAND_QUERY_CHUNK_SIZE)) {
      const chunkRows: XpandInvoiceRowDbRow[] = await invoiceListDb.raw(
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
        (repsr.keycode IN (${keycodes.map(() => '?').join(', ')}) AND keyrektk = 'INTAKT' AND repsk.year = datepart(year, krfkh.fromdate)) OR
        (krfkh.invoice like '5%' and (repsr.keycode is null and keyrektk is null and repsk.year is null)) or
        (krfkh.invoice like '8%' and ((repsr.keycode is null and keyrektk = 'INTAKT' and repsk.year = datepart(year, krfkh.fromdate)) or (repsr.keycode is null and keyrektk is null and repsk.year is null)))
      )
      AND cmcmp.code = ?
      AND (krfkh.type = 1 OR krfkh.type = 2)
      AND invoice IN (${chunk.map(() => 'CAST(? AS varchar(25))').join(', ')})
    ORDER BY invoice ASC, krfkr.printsort ASC
    `,
        [...keycodes, companyId, ...chunk]
      )
      invoiceRows.push(...chunkRows)
    }

    logger.info(
      {
        includedRows: invoiceRows.length,
        includedInvoices: new Set<string>(invoiceRows.map((row) => row.invoice))
          .size,
        requestedInvoices: invoiceNumbers.length,
      },
      'Retrieved invoices'
    )

    return invoiceRows.map(transformInvoiceRow)
  } catch (err: unknown) {
    logger.error({ err }, 'adapter.getInvoiceRows')
    throw err
  }
}

const sumColumns = (...values: number[]) => {
  const sum = values.reduce((acc, value) => acc + value, 0)
  return Math.round((sum + Number.EPSILON) * 100) / 100
}

const trimColumn = (column: string | null): string | null =>
  column ? column.trimEnd() : column

const transformInvoiceRow = (invoiceRow: XpandInvoiceRowDbRow): InvoiceRow => {
  const row: InvoiceRow = {
    amount: sumColumns(invoiceRow.rowAmount),
    deduction: sumColumns(invoiceRow.rowReduction),
    fromDate: xledgerDateString(invoiceRow.invoiceFromDate),
    invoiceDate: xledgerDateString(invoiceRow.invdate),
    invoiceDueDate: xledgerDateString(invoiceRow.expirationDate),
    invoiceNumber: invoiceRow.invoice.trimEnd(),
    invoiceRowText: trimColumn(invoiceRow.text),
    printGroup: trimColumn(invoiceRow.printGroup),
    rentArticle: trimColumn(invoiceRow.rentArticle),
    roundoff: sumColumns(invoiceRow.roundoff),
    rowType: sumColumns(invoiceRow.rowtype),
    toDate: xledgerDateString(invoiceRow.invoiceToDate),
    totalAmount: sumColumns(
      invoiceRow.rowAmount,
      invoiceRow.rowReduction,
      invoiceRow.rowVat
    ),
    vat: sumColumns(invoiceRow.rowVat),
  }

  // Type 2 is a credit invoice: reverse the signs.
  if (invoiceRow.type === 2) {
    row.totalAmount = -row.totalAmount
    row.amount = -row.amount
    row.vat = -row.vat
    row.deduction = -row.deduction
    row.roundoff = -row.roundoff
  }

  return row
}
