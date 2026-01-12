import {
  extractPhoneNumber,
  extractPhoneNumberComment,
} from '@src/adapters/xpand/transform'
import { ContactAddress } from '../../../src/domain/contact'
import { DbAddress } from '../../../src/adapters/xpand/db-model'
import { transformAddress } from '../../../src/adapters/xpand/transform'

describe('extractPhoneNumber', () => {
  it.each([
    ['0700098811', '0700098811'],
    ['    0700098811', '0700098811'],
    ['0700098811    ', '0700098811'],
    ['Dottern Ingrid: 0700098811    ', '0700098811'],
    ['Christer 073-11122333', '073-11122333'],
    ['Christer 0731112233           ', '0731112233'],
    ['       070-1943334 (Maud)     ', '070-1943334'],
    ['      021-110033 Björn        ', '021-110033'],
    ['  På en grusväg               ', undefined], // This an honest-to-god example from real life
  ])('should process "%s" and extract phone number "%s"', (input, expected) => {
    expect(extractPhoneNumber(input)).toEqual(expected)
  })

  it.each([
    ['0700098811', undefined],
    ['    0700098811', undefined],
    ['0700098811    ', undefined],
    ['Dottern Ingrid: 0700098811    ', 'Dottern Ingrid'],
    ['Dottern:Ingrid: 0700098811    ', 'Dottern:Ingrid'],
    ['Dottern Ingrid: 0700098811 Hemnummer', 'Dottern Ingrid, Hemnummer'],
    ['Christer 073-11122333', 'Christer'],
    ['Christer 0701112233           ', 'Christer'],
    ['       070-1943334 (Maud)     ', '(Maud)'],
    ['      021-110033 Björn        ', 'Björn'],
    ['  På en grusväg               ', 'På en grusväg'], // This an honest-to-god example from real life
  ])('should process "%s" and extract comment "%s"', (input, expected) => {
    expect(extractPhoneNumberComment(input)).toEqual(expected)
  })
})

type AddressTestCase = [
  Partial<DbAddress> & {
    lines: string[]
  },
  ContactAddress,
]

describe('transformAddress', () => {
  it.each([
    [
      {
        lines: [
          'Holländargatan 31',
          null,
          '113 59',
          'STOCKHOLM',
          'SVERIGE',
          null,
          null,
          null,
          null,
          null,
        ],
      },
      {
        street: 'Holländargatan',
        number: '31',
        zipCode: '113 59',
        city: 'STOCKHOLM',
        country: 'SVERIGE',
        full: 'Holländargatan 31, 113 59, STOCKHOLM, SVERIGE',
      },
    ],
    [
      {
        lines: [
          'Holländargatan 31',
          '                                           ',
          '113 59',
          'STOCKHOLM',
          'SVERIGE',
          null,
          null,
          null,
          null,
          null,
        ],
      },
      {
        street: 'Holländargatan',
        number: '31',
        zipCode: '113 59',
        city: 'STOCKHOLM',
        country: 'SVERIGE',
        full: 'Holländargatan 31, 113 59, STOCKHOLM, SVERIGE',
      },
    ],
  ] as AddressTestCase[])(
    'should process "%s" and extract address "%s"',
    (input, expected) => {
      const dbAddress = {
        adress1: input.lines[0],
        adress2: input.lines[1],
        adress3: input.lines[2],
        adress4: input.lines[3],
        adress5: input.lines[4],
        adress6: input.lines[5],
        adress7: input.lines[6],
        adress8: input.lines[7],
        adress9: input.lines[8],
        adress10: input.lines[9],
      }

      expect(transformAddress(dbAddress)).toEqual(expected)
    }
  )
})
