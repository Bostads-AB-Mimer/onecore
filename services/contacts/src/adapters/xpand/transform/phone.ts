import {
  PhoneNumber,
  PhoneNumberDetails,
  PhoneNumberType,
} from '@src/domain/contact'
import { DbPhoneNumber } from '../db-model'

/**
 * Regex that encloses any reasonable phone number format in a group
 * and allows leading and trailing noise.
 */
const PHONE_NUMBER_REGEX =
  /\s*((?:\+?\d{1,4}[\s-.]?)?(?:\(?\d{2,4}\)?[\s-.]?)?\d[\d\s-.]*\d)\s*/

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
