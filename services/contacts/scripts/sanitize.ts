#!/usr/bin/env -S pnpx node -r ts-node/register -r tsconfig-paths/register

import crypto from 'node:crypto'
import { DbAddress } from '@src/adapters/xpand/db-model'
import { extractAddress } from '@src/adapters/xpand/transform'

/**
 * Salt used to hash input. Do not change if there is any intention
 * of reproducing the test database from source.
 */
const SALT = 'd34db33f-contacts-testdata-DO-NOT-CHANGE'

const WORDS = [
  'Blubb',
  'Bjäbb',
  'Bork',
  'bork',
  'blurk',
  'banana',
  'korv',
  'häst',
  'sork',
  'TRATT',
  'BOLL',
]

const DOMAINS = [
  'example',
  'dummy',
  'test-domain',
  'null-and-void',
  'not-real',
  'mock-domain',
  'nobody-lives-here',
]

const FIRST_NAMES = [
  'Berit',
  'Klasse',
  'Stig-Britt',
  'Klodvig',
  'Zorro',
  'Knasen',
  'Ugglemor',
  'Ronny',
  'Sonny',
  'Conny',
  'Jonny',
  'Jimmy',
  'Tommy',
  'Fiskmor',
  'Lars',
  'Ola',
  'Jenny',
  'Harry',
  'Voldemort',
  'Bellatrix',
  'Frodo',
  'Gitarr-Jesper',
  'Maggan',
  'Molly',
  'Zoran',
  'Hilarius',
  'Boll-kalle',
  'Wulfie',
  'Palomba',
  'Tom',
  'Greta',
  'Konrad',
  'Skruv-Rune',
  'Hedvig',
]

const LAST_NAMES = [
  'Dumberg',
  'Franz-Ferdinand',
  'Olsson',
  'Julaftonsson',
  'Hare',
  'Wulfgangsson',
  'Olofsson',
  'Larsson',
  'Elmi',
  'Ibrahim',
  'Zig-Zagsson',
  'Djungelvrålsson',
  'Millions',
  'Slagverksson',
  'Tombola',
  'Kruukiväxtileinen',
  'Känguru',
  'Sten',
  'Berg',
  'Grus',
  'Singel',
  'Kross',
  'Makadam',
  'Älgfärsson',
  'Korvistoppitalo',
  'Hoola-Bandoola',
  'von Anka',
  'von Tratt',
]

const ZIP_CODES = [
  '112 30',
  '114 14',
  '113 59',
  '722 27',
  '724 80',
  '722 22',
  '72463',
  '724 72',
]

const STREETS = [
  'Holländargatan',
  'Korvstopperistigen',
  'Kängurutorp',
  'Brummelisavägen',
  'Ostkroksleden',
  'Mumindalsvägen',
  'Almogeplatsen',
  'Karlfeldtsplatsen',
  'Lövsångargatan',
  'Muffinstigen',
]

const capitalize = (str: string, ucase: boolean = false) =>
  ucase
    ? str.charAt(0).toUpperCase() + str.slice(1)
    : str.charAt(0).toLowerCase() + str.slice(1)

const hash = (input: string) => {
  return crypto
    .createHash('sha256')
    .update(SALT + input)
    .digest('hex')
}

const hashDigits = (input: string) => {
  return parseInt(hash(input).slice(0, 12), 16)
    .toString()
    .padStart(input.length, '0')
    .slice(0, input.length)
}

const hashNum = (num: any, min: number, max: number) => {
  return (parseInt(hash(String(num)).slice(0, 12), 16) % (max - min)) + min
}

const hashNumString = (str: string, min: number, max: number) => {
  return String((parseInt(hash(input).slice(0, 12), 16) % (max - min)) + min)
}

const pickElement = (input: string, candidates: string[]) =>
  candidates[Number(hashDigits(input)) % candidates.length]

/**
 * Sanitize a phoneNumber, or rather the contents of cmtel.cmtelben
 *
 */
export const sanitizePhoneNumber = (input: string | undefined) => {
  if (!input || !input.trim()) return

  const digits = hashDigits(input)
  let sanitized = ''
  const areaCode = /(?:^|[^0-9])(0[0-9]{2})/.exec(input)

  for (let i = 0; i < input.length; i++) {
    if (
      (!areaCode || !(i >= areaCode.index && i < areaCode.index + 4)) &&
      input.charAt(i).match(/[0-9]/)
    ) {
      sanitized += digits.charAt(i % digits.length)
    } else {
      sanitized += input.charAt(i)
    }
  }
  return sanitized
}

export const sanitizeName = (input: string | undefined) => {
  if (!input || !input.trim()) return

  const [lname, ...fnames] = input
    .split(' ')
    .map((p) => hashDigits(p.toLowerCase()))
    .map(Number)

  const sanitized = [
    LAST_NAMES[lname % LAST_NAMES.length],
    ...fnames.map((n) => FIRST_NAMES[n % FIRST_NAMES.length]),
  ].join(' ')

  return input.toLocaleUpperCase() === input
    ? sanitized.toLocaleUpperCase()
    : sanitized
}

export const sanitizeFirstName = (input: string | undefined) => {
  if (!input || !input.trim()) return

  const sanitized =
    FIRST_NAMES[
      Number(hashDigits(input.trim().toLocaleLowerCase())) % FIRST_NAMES.length
    ]
  return input.toLocaleUpperCase() === input
    ? sanitized.toLocaleUpperCase()
    : sanitized
}

export const sanitizeLastName = (input: string | undefined) => {
  if (!input || !input.trim()) return

  const sanitized =
    LAST_NAMES[
      Number(hashDigits(input.trim().toLocaleLowerCase())) % LAST_NAMES.length
    ]
  return input.toLocaleUpperCase() === input
    ? sanitized.toLocaleUpperCase()
    : sanitized
}

const ADDR_ORDER = ['street', 'number', 'zipCode', 'city', 'country']

export const sanitizeStreetAddress = (input: string) => {
  if (!input || !input.trim()) return undefined

  const match = input.match(/^([^0-9]+(\s[^0-9])*)\s?([0-9 ]*.*)/)
  if (match) {
    const street = match[1]?.trim() ?? ''
    const number = match[3]?.trim() ?? ''

    const numHash = Number(hashDigits(number))

    return [
      pickElement(street, STREETS),
      String(1 + (Number(hashDigits(number)) % 113)) +
        (number.match(/[a-zA-Z]$/)
          ? (Number(hashDigits(input)) % 10 < 3 ? '' : ' ') +
            ((numHash % 5) + 10).toString(16).toUpperCase()
          : ''),
    ].join(' ')
  }
  return pickElement(input, STREETS)
}

export const sanitizeAddress = (addr: any) => {
  const address = extractAddress(addr)

  let di = 0

  for (let i = 0; i < 10; i++) {
    const key = `adress${i + 1}`
    const line = addr[key]
    if (line && line.trim()) {
      if (address) {
        switch (ADDR_ORDER[di]) {
          case 'street':
            addr[key] = sanitizeStreetAddress(line)
            di++
            break
          case 'zipCode':
            addr[key] = pickElement(line, ZIP_CODES)
        }
      } else {
        addr[key] = pickElement(line, WORDS)
      }
    }
  }

  return addr
}

type DateSegments = [string, string, string]

const datePartsFromDigits = (digits: string): DateSegments => {
  digits = digits.replaceAll(/[^0-9]/g, '')
  const dateDigits = digits.length >= 10 ? digits.slice(0, -4) : digits
  return [
    dateDigits.slice(0, -4) ?? -1,
    dateDigits.slice(-4, -2) ?? -1,
    dateDigits.slice(-2) ?? -1,
  ].map(String) as DateSegments
}

const dateFromDigits = (digits: string): Date => {
  const segments = datePartsFromDigits(digits)
  const dSegs = segments.map(Number)
  const [y, m, d] = dSegs
  return new Date(y, m, d)
}

const sanitizeDate = (date: Date) => {
  const d = new Date(date)
  d.setDate(
    date.getDate() + hashNum(date.toISOString().slice(8), -8 * 365, 8 * 365)
  )
  return d
}

export const sanitizeBirthDate = (bdate: Date | undefined) => {
  if (!bdate) return
  return sanitizeDate(bdate)
}

export const sanitizeDateSegments = (segments: DateSegments): DateSegments => {
  const dSegs = segments.map(Number)
  const [y, m, d] = dSegs
  const date = sanitizeDate(new Date(y, m, d))
  const dStr = date.toISOString()
  return [
    dStr.slice(dSegs.length === 4 ? 0 : 2, 4),
    dStr.slice(5, 7),
    dStr.slice(8, 10),
  ]
}

export const sanitizePersOrgNr = (input: any) => {
  if (!input || !input.trim()) return
  let inputDigits = input.replaceAll(/[^0-9]/g, '')

  const sanitizedPnr =
    sanitizeDateSegments(datePartsFromDigits(inputDigits)).join('') +
    hashNumString(inputDigits.slice(-4), 0, 9999).padStart(4)

  let sanitized = ''
  for (let i = 0; i < input.length; i++) {
    if (input.charAt(i).match(/[0-9]/)) {
      sanitized += sanitizedPnr.charAt(i % sanitizedPnr.length)
    } else {
      sanitized += input.charAt(i)
    }
  }

  return sanitized
}

export const sanitizeEmail = (input: string | undefined) => {
  if (!input || !input.trim() || !input.includes('@')) return

  const toEmailPart = (s: string) => {
    return s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(' ', pickElement(s, ['.', '-']))
  }

  const [local, domain] = input.split('@')

  let sanitizedLocal = local

  const plusSplit = local.split('+')
  const base = plusSplit[0]
  const tag = plusSplit[1]

  const nameParts = base.split(/[._-]/)

  if (nameParts.length >= 1 && nameParts.length <= 3) {
    const sanitizedNames = nameParts.map((part, i) => {
      const ucasep = part.at(0)?.toLocaleUpperCase() === part.at(0)
      if (i === 0) return capitalize(sanitizeFirstName(part) ?? part, ucasep)
      if (i === nameParts.length - 1)
        return capitalize(sanitizeLastName(part) ?? part, ucasep)
      return capitalize(sanitizeFirstName(part) ?? part)
    })

    sanitizedLocal = base.replace(
      base,
      sanitizedNames.join(base.match(/[._-]/)?.[0] ?? '.')
    )
  } else {
    sanitizedLocal = toEmailPart(pickElement(base, WORDS))
  }

  if (tag) {
    sanitizedLocal += '+' + toEmailPart(pickElement(tag, WORDS).toLowerCase())
  }

  // --- domain ---
  const domainParts = domain.split('.')
  const tld = domainParts.pop()
  const sanitizedDomain = [
    pickElement(domainParts.join('.'), WORDS).toLowerCase(),
    `.${pickElement(input, DOMAINS)}`,
    tld ? '.' + tld : '',
  ].join('')

  return [sanitizedLocal, '@', sanitizedDomain].join('')
}

const [_, file, cmd, input, ...rest] = process.argv
if (file?.endsWith('sanitize.ts')) {
  switch (cmd) {
    case 'p':
    case 'phone':
      console.log(sanitizePhoneNumber(input))
      break
    case 'e':
    case 'email':
      console.log(sanitizeEmail(input))
      break
    case 'n':
    case 'name':
      console.log(sanitizeName(input))
      break
    case 'a':
    case 'address':
      console.log(
        sanitizeAddress(
          [input, ...rest].reduce((addr, part, i) => {
            addr[`adress${i + 1}`] = part
            return addr
          }, {} as any) as DbAddress
        )
      )
      break
    case 'pn':
    case 'persorgnr':
      console.log(sanitizePersOrgNr(input))
      break
    case 'bd':
    case 'birthdate':
      console.log(sanitizeBirthDate(dateFromDigits(input)))
  }
}
