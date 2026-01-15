import { ContactAddress, ObjectKey } from '../../domain/contact'
import { DbAddress, DbContactRow } from './db-model'
import {
  DbContact,
  DbContactDetails,
  DbContactDetailsMap,
  DbEmailAddress,
  DbPhoneNumber,
} from './db-model'
import {
  Contact,
  ContactIndividual,
  ContactOrganisation,
  ContactType,
  EmailAddress,
  PhoneNumber,
  PhoneNumberDetails,
  PhoneNumberType,
} from '@src/domain/contact'

/**
 * Trim any and all string values of a DB result row, as Xpand
 * has a bad habit of padding strings with spaces.
 *
 * @param obj The DB row to trim
 *
 * @returns The trimmed DB row
 */
export const trimRow = <T extends Record<string, any>>(obj: T): T => {
  return Object.fromEntries(
    Object.entries(obj ?? {}).map(([key, value]) => [
      key,
      typeof value === 'string' ? value.trimEnd() : value,
    ])
  ) as T
}

/**
 * Regex that encloses any reasonable phone number format in a group
 * and allows leading and trailing noise.
 */
const PHONE_NUMBER_REGEX =
  /\s*((?:\+?\d{1,4}[\s-.]?)?(?:\(?\d{2,4}\)?[\s-.]?)?\d[\d\s-.]*\d)\s*/

const REDACTED = 'redacted'

const NO_CONTACT_DETAILS: DbContactDetails = {
  phoneNumbers: [],
  emailAddresses: [],
  addresses: [],
}

/**
 * Mapping of Xpand phone number types to domain phone number types
 */
const PHONE_TYPE__XPAND_TO_DOMAIN: Record<string, PhoneNumberType> = {
  mobil: 'mobile',
  personsok: 'pager',
  telarbete: 'work',
  teldirect: 'direct-line',
  telhem: 'home',
  teltelefon: 'unspecified',
}

const redact = <T, Prop extends keyof T>(
  details: T[],
  field: Prop,
  protectedIdentity: boolean
) => {
  return protectedIdentity
    ? details.map((pn) => ({ ...pn, [field]: REDACTED }))
    : details
}

/**
 * Extracts the phone number from a string.
 *
 * The phone number data quality in Xpand is abyssmal and has no
 * constraint on formatting. There may or may not be dashes, parens
 * or other noise as well as general comments like "anh" or
 * "Hemtjänsten: <phonenumber>".
 */
export const extractPhoneNumber = (
  dbValue: string
): PhoneNumber | undefined => {
  const match = dbValue.match(PHONE_NUMBER_REGEX)
  if (!match || !match[1]) return

  return match[1]
}

/**
 * Expand and leading and trailing comments surrounding a phone
 * number in a string.
 *
 * Examples:
 * "Hemtjänsten: 070-123 45 67" -> "Hemtjänsten"
 * "0701234567 anh" -> "anh"
 * "Sonen Ola: 070-1234567 Bara tillgänglig jämna klockslag" ->
 *    "Sonen Ola, Bara tillgänglig jämna klockslag".
 *
 * @param dbValue The database value containing the phone number
 */
export const extractPhoneNumberComment = (dbValue: string) => {
  const pn = extractPhoneNumber(dbValue)
  if (!pn) return dbValue.trim()

  return (
    dbValue
      .split(pn)
      .map((part) => part.trim().replace(/:\s*$/, ''))
      .filter(Boolean)
      .join(', ') || undefined
  )
}

/**
 * Maps an Xpand phone number type to a domain phone number type.
 * If no mapping exists, 'unspecified' is returned. This includes
 * redundant types like 'teltelefon', because ALL phone numbers
 * are "telefon" numbers.
 *
 * @param type The Xpand phone number type
 *
 * @returns The corresponding domain phone number type
 */
const toPhoneNumberType = (type: string) =>
  PHONE_TYPE__XPAND_TO_DOMAIN[type] ?? 'unspecified'

/**
 * Transforms an array of database phone numbers to domain phone
 * number details.
 *
 * Discards any elements from which no reasonable phone number can
 * be extracted.
 *
 * @param pns The array of database phone numbers
 * @returns The array of transformed phone number details
 */
export const transformPhoneNumbers = (
  pns: DbPhoneNumber[]
): PhoneNumberDetails[] =>
  pns.map(transformPhoneNumber).filter((pn) => pn !== undefined)

/**
 * Transforms a database phone number to domain phone number details.
 *
 * If no reasonable phone number can be extracted, undefined is
 * returned.
 *
 * @param pn The database phone number
 * @returns The transformed phone number details or undefined
 */
export const transformPhoneNumber = (
  pn: DbPhoneNumber
): PhoneNumberDetails | undefined => {
  const phoneNumber = extractPhoneNumber(pn.phoneNumber)
  if (!phoneNumber) return undefined

  return {
    phoneNumber: phoneNumber,
    type: toPhoneNumberType(pn.phoneType),
    isPrimary: Boolean(pn.isPrimaryPhone),
    comment: extractPhoneNumberComment(pn.phoneNumber),
  }
}

export const transformAddress = (
  dbAddr: DbAddress
): ContactAddress | undefined => {
  const lines: (string | undefined)[] = [
    dbAddr.adress1,
    dbAddr.adress2,
    dbAddr.adress3,
    dbAddr.adress4,
    dbAddr.adress5,
    dbAddr.adress6,
    dbAddr.adress7,
    dbAddr.adress8,
    dbAddr.adress9,
    dbAddr.adress10,
  ]

  const address = lines.reduce(
    (result, line) => {
      if (line && line.trim()) {
        if (result.state === 'initial') {
          if (line.match(/^([^0-9]+(\s[^0-9])*)\s?([0-9 ]*.*)/)) {
            result.address.street = line.trim()
            result.state = 'expect-zip'
          }
        } else if (result.state === 'expect-zip') {
          if (line.match(/^[0-9 ]+$/)) {
            result.address.zipCode = line.trim()
            result.state = 'expect-city'
          }
        } else if (result.state === 'expect-city') {
          if (line.match(/^[\w\s]+/)) {
            result.address.city = line.trim()
            result.state = 'expect-country'
          }
        } else if (result.state === 'expect-country') {
          if (line.match(/^[\w\s]+/)) {
            result.address.country = line.trim()
            result.state = 'done'
          }
        }
      }
      return result
    },
    {
      state: 'initial' as string,
      address: {
        street: '',
        zipCode: '',
        city: '',
        country: '',
        full: lines
          .filter((l): l is string => typeof l === 'string' && l.trim() !== '')
          .map((l) => l.trim())
          .join(', '),
      } as ContactAddress,
    }
  )

  return address.address as ContactAddress
}

export const transformEmailAddresses = (
  emails: DbEmailAddress[]
): EmailAddress[] =>
  emails.map(transformEmailAddress).filter((em) => em !== undefined)

export const transformEmailAddress = (email: DbEmailAddress): EmailAddress => ({
  emailAddress: email.emailAddress,
  type: 'unspecified',
  isPrimary: email.isPrimaryEmail,
})

const toContactKeys = (row: DbContact) => ({
  contactCode: row.contactCode,
  contactKey: row.contactKey,
})

export const toCommunicationFragment = (
  row: DbContact,
  contactDetails: DbContactDetails,
  protectedIdentity: boolean
) => {
  return {
    phoneNumbers: redact(
      transformPhoneNumbers(contactDetails.phoneNumbers),
      'phoneNumber',
      protectedIdentity
    ),
    emailAddresses: redact(
      transformEmailAddresses(contactDetails.emailAddresses),
      'emailAddress',
      protectedIdentity
    ),
    specialAttention: !!row.specialAttention,
  }
}

export const toAddresses = (
  addresses: DbAddress[],
  protectedIdentity: boolean
): ContactAddress[] =>
  addresses.map(transformAddress).filter((a) => a !== undefined)

/**
 * Transform a DbContact row to a ContactIndividual domain object.
 *
 * @param row The DbContact row
 * @param contactDetails The DbContactDetails for the contact
 *
 * @returns The transformed ContactIndividual
 */
export const toIndividual = (
  row: DbContact,
  contactDetails: DbContactDetails
): ContactIndividual => {
  const protectedIdentity = row.protectedIdentity !== null

  return {
    type: 'individual',
    ...toContactKeys(row),
    personal: {
      firstName: protectedIdentity ? 'redacted' : row.firstName || '',
      lastName: protectedIdentity ? 'redacted' : row.lastName || '',
      fullName: protectedIdentity ? 'redacted' : row.fullName,
      nationalRegistrationNumber: protectedIdentity ? 'redacted' : row.nid,
      birthDate: protectedIdentity ? 'redacted' : row.birthDate,
    },
    communication: toCommunicationFragment(
      row,
      contactDetails,
      protectedIdentity
    ),
    addresses: toAddresses(contactDetails.addresses, protectedIdentity),
  }
}

/**
 * Transform a DbContact to a ContactOrganisation domain object
 */
export const toOrganisation = (
  row: DbContact,
  contactDetails: DbContactDetails
): ContactOrganisation => {
  return {
    type: 'organisation',
    ...toContactKeys(row),
    organisation: {
      organisationNumber: row.nid,
      name: row.fullName,
    },
    communication: toCommunicationFragment(row, contactDetails, false),
    addresses: toAddresses(contactDetails.addresses, false),
  }
}

/**
 * Determine the contact type of a DbContact row.
 *
 * The "law" that individuals have contact codes that begin with 'P' and
 * organisations with 'I' is not universal. There are hundreds of rows
 * in the Mimer database that have no leading character at all, and
 * a few hundred with a leading 'I', which seems to be internal.
 *
 * FIXME: In all likelihood the non-character prefixed contact codes are legacy
 * but this is where we could make a best-effort attempt to identify the
 * the type. This shoddy attempt doesn't hold water, as there are plenty
 * of individuals in the database that have null firstName(fnamn) values.
 *
 * @param dbContact The DbContact row
 *
 * @returns The resolved contact type
 */
export const resolveContactType = (dbContact: DbContact): ContactType => {
  const { contactCode } = dbContact

  switch (contactCode.charAt(0)) {
    case 'P':
      return 'individual'
    case 'I':
    case 'F':
      return 'organisation'
    default:
      if (contactCode.match(/^[0-9]/) && !dbContact.firstName) {
        return 'organisation'
      } else {
        return 'individual'
      }
  }
}

export const transformDbContacts = (
  dbRows: DbContact[],
  metadata: DbContactDetailsMap
) => {
  return dbRows.map((row) =>
    transformDbContact(row, metadata[row.contactKey] ?? NO_CONTACT_DETAILS)
  )
}

export const transformDbContact = (
  dbRow: DbContact,
  contactDetails: DbContactDetails
): Contact => {
  const row = trimRow(dbRow)
  const type = resolveContactType(dbRow)

  return type === 'individual'
    ? toIndividual(row, contactDetails)
    : toOrganisation(row, contactDetails)
}

export const toContact = (rows: DbContactRow[]): Contact => {
  const [contactData] = rows
  const contactDetails: DbContactDetails = {
    phoneNumbers: [],
    emailAddresses: [],
    addresses: [],
  }

  rows.forEach((row) => {
    if (
      row.addressId &&
      !contactDetails.addresses.some((a) => a.addressId === row.addressId)
    ) {
      contactDetails.addresses.push(row as DbAddress)
    }
    if (
      row.emailId &&
      !contactDetails.emailAddresses.some((e) => e.emailId === row.emailId)
    ) {
      contactDetails.emailAddresses.push(row as DbEmailAddress)
    }
    if (
      row.phoneNumber &&
      !contactDetails.phoneNumbers.some((p) => p.phoneId === row.phoneId)
    ) {
      contactDetails.phoneNumbers.push(row as DbPhoneNumber)
    }
  })

  return transformDbContact(contactData, contactDetails)
}

export const collapseContactRows = (rows: DbContactRow[]) => {
  return rows.reduce(
    (aggr, row) => {
      ;(aggr[row.objectKey] ??= []).push(row)
      return aggr
    },
    {} as Record<ObjectKey, DbContactRow[]>
  )
}

export const transformDbContactRows = (rows: DbContactRow[]) => {
  const byContact = collapseContactRows(rows)
  return Object.values(byContact).map(toContact)
}
