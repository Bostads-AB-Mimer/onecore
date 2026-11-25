import knex from 'knex'
import { logger } from '@onecore/utilities'
import { Address, RentalProperty, RentInvoiceRow } from '@onecore/types'

import config from '../../../common/config'
import { RentInvoice } from '../types'
import { InvoiceDeliveryMethod, XpandContact } from '../../../common/types'
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

type XpandInvoice = {
  invoiceNumber: string
  reference: string
  roundoff: number
  fromDate: Date
  toDate: Date
  invoiceDate: Date
  expiryDate: Date
  lastDebitDate: Date | null
  careOf: string | null
}

type XpandRentalPropertyRow = {
  rentalId: string
  address: string | null
  postalCode: string | null
  city: string | null
  type: string
  areaSize: number | null
}

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

const buildRentalPropertyQuery = ({
  rentalIds,
  entityTable,
  typeCaptionTable,
  typeJoin,
  areaSizeKey,
}: {
  rentalIds: string[]
  entityTable: string
  typeCaptionTable: string
  typeJoin: string
  areaSizeKey?: string
}): Promise<XpandRentalPropertyRow[]> => {
  const query = db
    .select(
      'babuf.hyresid AS rentalId',
      'babuf.caption AS address',
      'cmadr.adress3 AS postalCode',
      'cmadr.adress4 AS city',
      `${typeCaptionTable}.caption AS type`,
      areaSizeKey ? 'cmval.value AS areaSize' : db.raw('NULL AS areaSize')
    )
    .from('babuf')
    .innerJoin('cmobj', 'babuf.keycmobj', 'cmobj.keycmobj')
    .innerJoin(entityTable, 'cmobj.keycmobj', `${entityTable}.keycmobj`)
    .innerJoin(
      typeCaptionTable,
      `${entityTable}.${typeJoin}`,
      `${typeCaptionTable}.${typeJoin}`
    )
    .leftJoin('cmadr', 'cmobj.keycmobj', 'cmadr.keycode')
    .where('cmobj.keycmobt', entityTable)
    .whereRaw(
      `babuf.hyresid IN (${rentalIds.map((id) => `'${id}'`).join(', ')})`
    )

  if (areaSizeKey) {
    query.leftJoin('cmval', function () {
      this.on('cmobj.keycmobj', '=', 'cmval.keycode').andOn(
        'cmval.keycmvat',
        '=',
        db.raw('?', [areaSizeKey])
      )
    })
  }

  return query.then(trimStrings<XpandRentalPropertyRow[]>)
}

export const toRentalProperty = (
  row: XpandRentalPropertyRow,
  rentalPropertyType: string
): RentalProperty => ({
  rentalPropertyId: row.rentalId,
  apartmentNumber: 0,
  size: row.areaSize ?? 0,
  type: row.type,
  rentalPropertyType,
  address: {
    street: row.address ?? '',
    number: '',
    postalCode: row.postalCode ?? '',
    city: row.city ?? '',
  },
  additionsIncludedInRent: '',
  otherInfo: undefined,
  roomTypes: undefined,
  lastUpdated: undefined,
})

/**
 * Rental properties from Xpand, in the same shape as the Tenfast adapter
 * returns. rentalPropertyType uses Tenfast's type values ('bostad' etc.) so
 * callers can treat both sources alike.
 */
export const getRentalProperties = async (
  rentalIds: string[]
): Promise<RentalProperty[]> => {
  if (rentalIds.length === 0) {
    return []
  }

  try {
    const [residences, parkingSpaces, facilities, other] = await Promise.all([
      buildRentalPropertyQuery({
        rentalIds,
        entityTable: 'balgh',
        typeCaptionTable: 'balgt',
        typeJoin: 'keybalgt',
        areaSizeKey: 'BOA',
      }),
      buildRentalPropertyQuery({
        rentalIds,
        entityTable: 'babps',
        typeCaptionTable: 'babpt',
        typeJoin: 'keybabpt',
        areaSizeKey: 'BRA',
      }),
      buildRentalPropertyQuery({
        rentalIds,
        entityTable: 'balok',
        typeCaptionTable: 'balot',
        typeJoin: 'keybalot',
        areaSizeKey: 'BRA',
      }),
      buildRentalPropertyQuery({
        rentalIds,
        entityTable: 'bahyr',
        typeCaptionTable: 'bahyt',
        typeJoin: 'keybahyt',
      }),
    ])

    return [
      ...residences.map((r) => toRentalProperty(r, 'bostad')),
      ...parkingSpaces.map((p) => toRentalProperty(p, 'parkering')),
      ...facilities.map((f) => toRentalProperty(f, 'lokal')),
      ...other.map((o) => toRentalProperty({ ...o, areaSize: null }, 'övrigt')),
    ]
  } catch (err: unknown) {
    logger.error({ err }, 'xpand-db-adapter.getRentalProperties')
    throw err
  }
}

export const getInvoices = async (
  invoiceNumbers: string[]
): Promise<RentInvoice[]> => {
  if (invoiceNumbers.length === 0) {
    return []
  }

  try {
    const invoices = await db
      .select(
        'krfkh.invoice AS invoiceNumber',
        'krfkh.reference',
        'krfkh.roundoff',
        'krfkh.fromdate AS fromDate',
        'krfkh.todate AS toDate',
        'krfkh.invdate AS invoiceDate',
        'krfkh.expdate AS expiryDate',
        'hyobj.sistadeb AS lastDebitDate',
        'cmctc.cmctcben AS careOf'
      )
      .from('krfkh')
      .innerJoin('hyobj', 'krfkh.reference', 'hyobj.hyobjben')
      .leftJoin('cmctc', 'krfkh.keycmctc2', 'cmctc.keycmctc')
      .whereRaw(
        `krfkh.invoice IN (${invoiceNumbers.map((n) => `'${n}'`).join(', ')})`
      )
      .then(trimStrings<XpandInvoice[]>)

    return invoices.map((invoice): RentInvoice => ({
      invoiceNumber: invoice.invoiceNumber,
      reference: invoice.reference,
      roundoff: invoice.roundoff,
      fromDate: new Date(invoice.fromDate),
      toDate: new Date(invoice.toDate),
      invoiceDate: new Date(invoice.invoiceDate),
      expiryDate: new Date(invoice.expiryDate),
      lastDebitDate: invoice.lastDebitDate
        ? new Date(invoice.lastDebitDate)
        : undefined,
      careOf: invoice.careOf ?? undefined,
    }))
  } catch (err: unknown) {
    logger.error({ err }, 'xpand-db-adapter.getInvoices')
    throw err
  }
}

export const getInvoiceRows = async (
  invoiceNumbers: string[]
): Promise<RentInvoiceRow[]> => {
  if (invoiceNumbers.length === 0) {
    return []
  }

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

/**
 * Xpand stores national registration numbers as YYYYMMDDNNNN or YYMMDDNNNN.
 * Returns YYMMDD-NNNN, the format the Tenfast adapter uses.
 */
export const formatNationalRegistrationNumber = (
  value: string | null | undefined
): string => {
  let nationalRegistrationNumber = value?.trimEnd() ?? ''
  if (!nationalRegistrationNumber) {
    return ''
  }

  if (nationalRegistrationNumber.length > 11) {
    nationalRegistrationNumber = nationalRegistrationNumber.substring(2)
  }

  const splitAt = nationalRegistrationNumber.length - 4
  return (
    nationalRegistrationNumber.substring(0, splitAt) +
    '-' +
    nationalRegistrationNumber.substring(splitAt)
  )
}

const sameCode = (a: string | null | undefined, b: string) =>
  a?.trimEnd().toUpperCase() === b.trimEnd().toUpperCase()

export const getContacts = async (
  contactCodes: string[]
): Promise<XpandContact[]> => {
  if (contactCodes.length === 0) {
    return []
  }

  try {
    const [rows, emailAddresses, invoiceAddresses, phoneNumbers] =
      await Promise.all([
        db
          .from('cmctc')
          .select(
            'cmctc.cmctckod as contactCode',
            'cmctc.fnamn as firstName',
            'cmctc.enamn as lastName',
            'cmctc.cmctcben as fullName',
            'cmctc.persorgnr as nationalRegistrationNumber',
            'cmctc.birthdate as birthDate',
            'cmctc.keycmctc as contactKey',
            'cmctc.lagsokt as protectedIdentity',
            'cmctc.avliden as deceased',
            'cmctc.konkurs as emigrated',
            'cmctc.blockinfo as noAdvertising',
            'cmctcCareOf.cmctcben as careOf',
            'krknr.autogiro as autogiro'
          )
          .leftJoin('krknr', 'cmctc.keycmctc', 'krknr.keycmctc')
          .leftJoin(
            'cmctc AS cmctcCareOf',
            'cmctc.keycmctc2',
            'cmctcCareOf.keycmctc'
          )
          .distinct()
          .whereIn('cmctc.cmctckod', contactCodes),
        db('cmeml')
          .select('cmemlben', 'cmctckod')
          .innerJoin('cmctc', 'cmeml.keycmobj', 'cmctc.keycmobj')
          .whereIn('cmctckod', contactCodes)
          .orderBy('main', 'desc'),
        // Newest address first, so find() below picks the current one
        db('cmadr')
          .select('cmctckod', 'adress1', 'adress3', 'adress4')
          .innerJoin('cmctc', 'cmadr.keycode', 'cmctc.keycmobj')
          .whereIn('cmctckod', contactCodes)
          .orderBy('cmctckod', 'asc')
          .orderBy('fdate', 'desc')
          .orderBy('tdate', 'desc'),
        db
          .from('cmctc')
          .select(
            'cmctc.cmctckod as contactCode',
            'cmtel.cmtelben as phoneNumber',
            'cmtel.keycmtet as type',
            'cmtel.main as isMainNumber'
          )
          .innerJoin('cmtel', 'cmctc.keycmobj', 'cmtel.keycmobj')
          .whereIn('cmctc.cmctckod', contactCodes)
          .then(trimStrings),
      ])

    const getContactAddress = (contactCode: string): Address => {
      const invoiceAddress = invoiceAddresses.find((a) =>
        sameCode(a.cmctckod, contactCode)
      )

      return {
        street: invoiceAddress?.adress1?.trimEnd() ?? '',
        postalCode: invoiceAddress?.adress3?.trimEnd() ?? '',
        city: invoiceAddress?.adress4?.trimEnd() ?? '',
        number: '',
      }
    }

    return rows.map((contactRow): XpandContact => {
      const contactCode: string = contactRow.contactCode?.trimEnd() ?? ''
      const emailAddress: string =
        emailAddresses
          .find((e) => sameCode(e.cmctckod, contactCode))
          ?.cmemlben?.trimEnd() ?? ''

      return {
        contactCode,
        contactKey: contactRow.contactKey?.trimEnd(),
        firstName: contactRow.firstName?.trimEnd(),
        lastName: contactRow.lastName?.trimEnd(),
        fullName: contactRow.fullName?.trimEnd(),
        careOf: contactRow.careOf?.trimEnd(),
        nationalRegistrationNumber: formatNationalRegistrationNumber(
          contactRow.nationalRegistrationNumber
        ),
        birthDate: contactRow.birthDate,
        isTenant: true,
        address: getContactAddress(contactCode),
        phoneNumbers: phoneNumbers.filter((pn) =>
          sameCode(pn.contactCode, contactCode)
        ),
        emailAddress,
        autogiro: Boolean(contactRow.autogiro),
        invoiceDeliveryMethod:
          emailAddress !== ''
            ? InvoiceDeliveryMethod.Email
            : InvoiceDeliveryMethod.Other,
        ...mapContactFlags(contactRow),
      }
    })
  } catch (err: unknown) {
    logger.error({ err }, 'xpand-db-adapter.getContacts')
    throw err
  }
}

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
