import { ContactAddress } from '@src/domain/contact'
import { DbAddress } from '../db-model'

/**
 * Regex for identifying a street address
 */
const STREET_ADDR_REGEX = /^([^0-9]+(\s[^0-9])*)\s?\.?([0-9 ]+)/

/**
 * Iteration state for parsing c/o addresses
 */
type CoParseState = {
  state: 'initial' | 'street-num' | 'co'
  addr: Partial<ContactAddress>
}

/**
 * Reduces and parses the free-form lines of an address entry as found
 * in `cmadr` in the Xpand database. It's a dirty job, but someone had
 * to do it.
 *
 * The address lines may be NULL, an empty string padded with whitespace
 * to column length, or an arbitrary part of an address field.
 *
 * Fortunately, it's a given that they invariably occur in some notion
 * of a natural order.
 *
 * Q: Is it borderline madness to even attempt this?
 * A: Yes, absolutely.
 *
 * Q: Does it work?
 * A: Also yes - it actually does.
 *
 * Q: But what if it doesn't?
 * A: There _is_ a fail-safe where all non-null/non-empty parts of the
 *    input are concatenated and stored in the `full` property of the
 *    resulting address. No data loss. Scouts honour.
 *
 * @param dbAddr The DB address record to extract from
 *
 * @returns The extracted address, or undefined if no address
 */
export const extractAddress = (
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
          const coMatch = line.match(/[cC]\/[oO]/)
          if (coMatch) {
            const co = parseCareOf(line)
            if (co.careOf) result.address.careOf = co.careOf
            if (co.street) {
              result.address.street = co.street
              result.state = 'expect-zip'
            }
          } else if (line.match(/^([^0-9]+(\s[^0-9])*)\s?([0-9 ]*.*)/)) {
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

/**
 * Parses an address line containing 'c/o', which may or may
 * not include the street address.
 *
 * This occurs in a variety of formats - all handled by this
 * function:
 *
 * 'c/o <Name>',
 * 'c/o<Name>',
 * 'c/o <Name> <StreetAddress>',
 * 'c/o <Name>/<StreetAddress>',
 * '<StreetAddress> c/o <Name>',
 *
 * @param input The input string containing 'c/o'
 * @returns The parsed care-of address parts
 */
export const parseCareOf = (input: string) => {
  input = input.trim()
  const coPos = input.toLowerCase().indexOf('c/o')
  const co = input.substring(coPos, coPos + 3)
  const pre = input.substring(0, coPos).trim()
  const post = input.substring(coPos + 3).trim()

  const coParts = post
    .replaceAll(/,/g, '')
    .replaceAll('/', ' ')
    .trim()
    .split(' ')

  if (pre.match(STREET_ADDR_REGEX)) {
    coParts.push(pre)
  }

  const addressResult = coParts.reverse().reduce(
    (result, part) => {
      if (part.match(/^[0-9]+/)) {
        result.addr.street = part
        result.state = 'street-num'
      } else if (part.match(STREET_ADDR_REGEX)) {
        result.addr.street = part
        result.state = 'co'
      } else {
        if (result.state === 'street-num') {
          result.addr.street = [part, result.addr.street].join(' ')
          result.state = 'co'
        } else {
          result.addr.careOf = [
            part,
            ...[result.addr.careOf].filter(Boolean),
          ].join(' ')
        }
      }
      return result
    },
    { state: 'initial', addr: {} } as CoParseState
  )

  if (addressResult.addr.careOf) {
    addressResult.addr.careOf = [co, addressResult.addr.careOf].join(' ')
  }

  if (Object.keys(addressResult.addr).length === 0) {
    return { careOf: input.trim() }
  }

  return addressResult.addr
}

export const toAddresses = (
  addresses: DbAddress[],
  protectedIdentity: boolean
): ContactAddress[] =>
  addresses.map(extractAddress).filter((a) => a !== undefined)
