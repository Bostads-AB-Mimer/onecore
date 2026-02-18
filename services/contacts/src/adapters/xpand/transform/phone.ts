import { PhoneNumberDetails, PhoneNumberType } from '@src/domain/contact'
import { DbPhoneNumber } from '../db-model'

/**
 * Regex that encloses any reasonable(and a few unreasonable) phone number formats
 * in a group. This allows leading and trailing noise, as well as some non-standard
 * symbols and occuring typos.
 */
const PHONE_NUMBER_REGEX =
  /\s*((?:\+?\d{1,4}[\s\-.*()#´]?)?(?:\(?\d{2,4}\)?[\s\-.*()]?)?\d[\d\s\-.*()]*\d)\s*/

//
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
 * Contains a single extracted phone number.
 */
type ExtractResult = {
  /**
   * The extracted phone number
   */
  extracted: string
  /**
   * If, and only if, the extracted phone number has in any way been
   * sanitized, expanded or inferred from an extension this field
   * contains the exact portion of the input that the number was
   * derived from.
   */
  literal?: string
}

/**
 * Expands extracted phone numbers by inferring missing area codes
 * or expanding slash-separated extensions where they can be derived
 * from within the same extraction result.
 *
 * This never occurs across database rows, and general idea is to be
 * bold but not risk polluting the data set with incorrect numbers.
 *
 * If at all applicable to the provided ExtractResult[], this
 * function delegates to either of:
 * - `expandSlashSeparatedExtensions`
 * - `inferAreaCode`
 *
 * Expansion of slash-separated extension substitutions are only ever
 * attempted if the ExtractResult[] already contains more than one full
 * phone number
 *
 * Reversely, area code inference is never attempted when only one
 * number has been extracted, as there is nothing to infer from.
 *
 * These algorithms occupy the fuzzy borderland between helpful data
 * enrichment/sanitization and the clever foolishness where data pollution
 * lives. They are intended and expected to run against a very specific
 * production data set, and they have been rigorously verified against
 * a unit test suite that has been that has been carefully assembled
 * from a reduced set of anonymized real-world data that includes
 * all occurring oddities and idiosyncratic formats.
 *
 * There are a handful of outlier cases that do not benefit from
 * these functions, those are left unmodified apart from trimming
 * unwarranted padding.
 *
 * @param input The original input string
 * @param result The extracted phone numbers
 */
export const inferSplitShorthands = (
  input: string,
  result: ExtractResult[]
) => {
  if (result.length === 1) {
    const [fullNumber] = result
    return expandSlashSeparatedExtensions(input, fullNumber)
  }
  if (result.length > 1) {
    return inferAreaCode(result)
  }

  return result
}

/**
 * Expands slash-separated extensions in a phone number extraction if
 * any can be identified.
 *
 * An example of such input is "0441-123 22 28/30", which very clearly
 * is intended to encode both "0441-123 22 28" and "0441-123 22 30".
 *
 * For the input of "0441-123 22 28/30", the first extraction pass
 * will have yielded the full number "0441-123 22 28" and discarded
 * "30" as it's not by any definition a full phone number.
 *
 * For expansion to trigger, the slash must immediately follow the
 * successfully extracted number in the original input and be
 * one or more groups digits of the same length.
 *
 * @param input The original input string
 * @param result The previously extracted phone number that will act
 *               as the base
 *
 * @returns The expanded list of extracted phone numbers, or a list
 *          containing only the original ExtractResult if no expansion
 *          is possible.
 */
export const expandSlashSeparatedExtensions = (
  input: string,
  result: ExtractResult
) => {
  const literal = result.literal ?? result.extracted
  const right = input.slice(input.indexOf(literal) + literal.length).trim()

  if (right.startsWith('/')) {
    const exts = right
      .split(/[/]/)
      .map((p) => p.trim())
      .filter((p) => p.match(/[\d]+/))
    const extLen = exts
      .map((e) => e.length)
      .reduce((same: number | false | null, len: number) => {
        if (same === null) return len
        if (same === false) return false
        return same === len ? len : false
      }, null)

    if (typeof extLen === 'number') {
      return [
        result,
        ...exts.map((ext) => ({
          extracted: result.extracted.slice(0, -extLen) + ext,
          literal: ext,
        })),
      ]
    }
  }

  return [result]
}

/**
 * Infers missing area codes for extracted phone numbers when
 * exactly one area code can be identified among multiple
 * extractions from the same input string/single value of cmtelben.
 *
 * For example, from the input "0441-123 22 28, 123 1290", the first
 * number contains an area code of "0441", which can be safely
 * inferred to also apply to the second number, yielding
 * "0441-123 1290".
 *
 * This inference will not be attempted if multiple different area
 * codes are found among the extractions, as that would introduce
 * ambiguity.
 *
 * A number of other criteria must also be fulfilled in order to
 * make a number eligible for being modified with an area code:
 *
 * - The resulting phone number must have the exact same number of
 *   digits as the number from which the area code was extracted.
 *
 * - A candidate can not have a country code or contain dashes.
 *
 * - A candidate can not have leading numbers that are equal to
 *   the area code we are attempting to apply.
 *
 * @param result The extracted phone numbers
 *
 * @returns The phone numbers, possibly prepended with inferred area
 *          codes
 *
 */
export const inferAreaCode = (result: ExtractResult[]) => {
  const areaCodeByIndex = result.map(({ extracted }) => {
    const dashIdx = extracted.indexOf('-')
    if (dashIdx > 2 && dashIdx < 5) return extracted.slice(0, dashIdx)
  })

  const areaCodes = areaCodeByIndex.filter(Boolean)
  if (areaCodes.length === 1 && result.length > 1) {
    const acIndex = areaCodeByIndex.findIndex(Boolean)
    const digitsByIndex = result.map(({ extracted }) =>
      extracted.replaceAll(/[^\d]/g, '')
    )
    const [areaCode] = areaCodes
    return result.map((xr, i) => {
      if (
        i == acIndex ||
        digitsByIndex[i].length === digitsByIndex[acIndex].length ||
        xr.extracted.startsWith('+') ||
        xr.extracted.includes('-') ||
        xr.extracted.startsWith(areaCode!.slice(0, 2))
      )
        return xr
      return {
        extracted: `${areaCode}-${xr.extracted}`,
        literal: xr.literal ?? xr.extracted,
      }
    })
  }

  return result
}

/**
 * Extracts phone numbers from a cmtelben column value.
 *
 * The phone number data quality in Xpand is abyssmal and has no
 * constraint on formatting. There may or may not be dashes, parens
 * or other noise as well as general comments like "anh" or
 * "Hemtjänsten: <phonenumber>".
 *
 * This function makes no attempts at regrouping the digit series of
 * various phone number notations, but it does clean out
 * noise and use non-standard whitespace characters that occur.
 * It also replaces some symbols that occur as separator between
 * area code and number with a dash.
 *
 * There's also an uncommon, but occurring, habit of compressing
 * two phone numbers into the same row and omitting area codes or
 * using a notation to encode multiple extension endings of a
 * single base number. When possible, these are expanded into
 * separate rows.
 *
 * @param dbValue The cmtelben database value containing phone number(s)
 * @returns The extracted phone number(s)
 */
export const extractPhoneNumber = (dbValue: string): ExtractResult[] => {
  const result: ExtractResult[] = []
  let exhausted = false
  let remaining = dbValue
  while (!exhausted) {
    const match = remaining.match(PHONE_NUMBER_REGEX)
    if (!match || !match[1]) {
      exhausted = true
      continue
    }
    if (match[1].length > 5) {
      const cleaned = match[1].replaceAll(/\s/g, ' ').replaceAll(/[´.]/g, '-')
      result.push({
        extracted: cleaned,
        ...(cleaned === match[1] ? {} : { literal: match[1] }),
      })
    }
    remaining = remaining.replaceAll(match[1], '')
  }

  return inferSplitShorthands(dbValue, result)
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
 * @param pn The phone number part of the string
 */
export const extractPhoneNumberComment = (
  dbValue: string,
  pn: string | undefined
) => {
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
  pns.flatMap(transformPhoneNumber).filter((pn) => pn !== undefined)

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
): PhoneNumberDetails[] => {
  const extractedNumbers = extractPhoneNumber(pn.phoneNumber)
  if (extractedNumbers.length === 0) return []

  return extractedNumbers.map((num, i) => ({
    phoneNumber: num.extracted,
    type: toPhoneNumberType(pn.phoneType),
    isPrimary: i > 0 ? Boolean(pn.isPrimaryPhone) : false,
    comment: extractPhoneNumberComment(
      pn.phoneNumber,
      num.literal ?? num.extracted
    ),
  }))
}
