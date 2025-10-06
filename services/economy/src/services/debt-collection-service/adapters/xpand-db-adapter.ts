import knex from 'knex'
import config from '../../../common/config'
import { RentInvoiceRow, RentInvoice, RentalProperty } from '../types'
import { InvoiceDeliveryMethod, XpandContact } from '../../../common/types'
import trimStrings from '../../../utils/trimStrings'
import { Address } from '@onecore/types'

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

// TODO zod schema?
type XpandInvoice = {
  keycmctc2: string | null
  invoiceNumber: string
  reference: string
  fromDate: Date
  toDate: Date
  invoiceDate: Date
  expiryDate: Date
  lastDebitDate: Date | null
  careOf: string | null
}

type XpandInvoiceRow = {
  invoiceNumber: string
  text: string
  amount: number
  reduction: number
  vat: number
  code: string
  printGroup: string | null
  invoiceRowType: string
  rentType: string | null
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
  areaSizeKey: string
}) => {
  return db
    .select(
      'babuf.hyresid AS rentalId',
      'babuf.caption AS address',
      'babuf.code',
      'cmadr.adress3 AS postalCode',
      'cmadr.adress4 AS city',
      `${typeCaptionTable}.caption AS type`,
      'cmval.value AS areaSize'
    )
    .from('babuf')
    .innerJoin('cmobj', 'babuf.keycmobj', 'cmobj.keycmobj')
    .innerJoin(entityTable, 'cmobj.keycmobj', `${entityTable}.keycmobj`)
    .innerJoin(
      typeCaptionTable,
      `${entityTable}.${typeJoin}`,
      `${typeCaptionTable}.${typeJoin}`
    )
    .innerJoin('cmadr', 'cmobj.keycmobj', 'cmadr.keycode')
    .leftJoin('cmval', function () {
      this.on('cmobj.keycmobj', '=', 'cmval.keycode').andOn(
        'cmval.keycmvat',
        '=',
        db.raw('?', [areaSizeKey])
      )
    })
    .where('cmobj.keycmobt', entityTable)
    .whereRaw(
      `babuf.hyresid IN (${rentalIds.map((id) => `'${id}'`).join(', ')})`
    )
    .then(trimStrings)
}

export const getRentalProperties = async (
  rentalIds: string[]
): Promise<RentalProperty[]> => {
  const [residences, parkingSpaces, facilities] = await Promise.all([
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
  ])

  return [
    ...residences.map(
      (r): RentalProperty => ({
        rentalPropertyType: 'Residence',
        rentalId: r.rentalId,
        address: r.address,
        code: r.code,
        postalCode: r.postalCode,
        city: r.city,
        type: r.type,
        areaSize: r.areaSize,
      })
    ),
    ...parkingSpaces.map(
      (p): RentalProperty => ({
        rentalPropertyType: 'ParkingSpace',
        rentalId: p.rentalId,
        address: p.address,
        code: p.code,
        postalCode: p.postalCode,
        city: p.city,
        type: p.type,
        areaSize: p.areaSize,
      })
    ),
    ...facilities.map(
      (f): RentalProperty => ({
        rentalPropertyType: 'Facility',
        rentalId: f.rentalId,
        address: f.address,
        code: f.code,
        postalCode: f.postalCode,
        city: f.city,
        type: f.type,
        areaSize: f.areaSize,
      })
    ),
  ]
}

export const getInvoices = async (
  invoiceNumbers: string[]
): Promise<RentInvoice[]> => {
  const invoices = await db
    .select(
      'krfkh.keycmctc2',
      'krfkh.invoice AS invoiceNumber',
      'krfkh.reference',
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

  return invoices.map((invoice) => ({
    invoiceNumber: invoice.invoiceNumber,
    reference: invoice.reference,
    fromDate: new Date(invoice.fromDate),
    toDate: new Date(invoice.toDate),
    invoiceDate: new Date(invoice.invoiceDate),
    expiryDate: new Date(invoice.expiryDate),
    lastDebitDate: invoice.lastDebitDate
      ? new Date(invoice.lastDebitDate)
      : undefined,
    careOf: invoice.careOf ?? undefined,
  }))
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
      'cmart.utskrgrupp AS printGroup',
      'cmarg.caption AS invoiceRowType',
      'hysum.hysumben AS rentType'
    )
    .from('krfkh')
    .innerJoin('krfkr', 'krfkh.keykrfkh', 'krfkr.keykrfkh')
    .innerJoin('cmart', 'krfkr.keycmart', 'cmart.keycmart')
    .innerJoin('cmarg', 'cmart.keycmarg', 'cmarg.keycmarg')
    .leftJoin('hysum', 'cmart.keyhysum', 'hysum.keyhysum')
    .whereRaw(
      `krfkh.invoice IN (${invoiceNumbers.map((n) => `'${n}'`).join(', ')})`
    )
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
      printGroup: row.printGroup,
    }
  })
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
      'cmctcCareOf.cmctcben as careOf',
      'krknr.autogiro as autogiro'
    )
    .leftJoin('krknr', 'cmctc.keycmctc', 'krknr.keycmctc')
    .leftJoin('cmctc AS cmctcCareOf', 'cmctc.keycmctc2', 'cmctcCareOf.keycmctc')

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

  const phoneNumbers = await db
    .from('cmctc')
    .select(
      'cmctc.cmctckod as contactCode',
      'cmtel.cmtelben as phoneNumber',
      'cmtel.keycmtet as type',
      'cmtel.main as isMainNumber'
    )
    .innerJoin('cmtel', 'cmctc.keycmobj', 'cmtel.keycmobj')
    .whereIn('cmctc.cmctckod', contactCodes)
    .then(trimStrings)

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

  const getPhoneNumbers = (contactCode: string) => {
    const phoneNumbersForContact = phoneNumbers.filter((pn) => {
      return pn.contactCode && pn.contactCode.localeCompare(contactCode) === 0
    })

    return phoneNumbersForContact
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

    return {
      contactCode: contactRow.contactCode?.trimEnd(),
      contactKey: contactRow.contactKey?.trimEnd(),
      firstName: contactRow.firstName?.trimEnd(),
      lastName: contactRow.lastName?.trimEnd(),
      fullName: contactRow.fullName?.trimEnd(),
      careOf: contactRow.careOf?.trimEnd(),
      nationalRegistrationNumber,
      birthDate: contactRow.birthDate,
      isTenant: true,
      address: getContactAddress(contactCode),
      phoneNumbers: getPhoneNumbers(contactCode),
      emailAddress: emailAddress,
      autogiro: contactRow.autogiro && contactRow.autogiro !== 0,
      invoiceDeliveryMethod:
        emailAddress !== ''
          ? InvoiceDeliveryMethod.Email
          : InvoiceDeliveryMethod.Other,
    }
  })

  return contacts
}
