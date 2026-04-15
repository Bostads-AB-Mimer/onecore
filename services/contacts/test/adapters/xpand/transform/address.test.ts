import { parseCareOf, extractAddress } from '@xpand/transform'
import { ContactAddress } from '@src/domain/contact'
import { DbAddress } from '@xpand/db-model'

type AddressTestCase = [
  Partial<DbAddress> & {
    lines: string[]
  },
  ContactAddress,
]

describe('extractAddress', () => {
  it.each([
    [
      {
        lines: ['Holländargatan 31', null, '113 59', 'STOCKHOLM', 'SVERIGE'],
      },
      {
        street: 'Holländargatan 31',
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
        ],
      },
      {
        street: 'Holländargatan 31',
        zipCode: '113 59',
        city: 'STOCKHOLM',
        country: 'SVERIGE',
        full: 'Holländargatan 31, 113 59, STOCKHOLM, SVERIGE',
      },
    ],
    [
      {
        lines: [
          'C/o Ronny Maräng',
          'Svissgatan 22',
          '600 12',
          'KLOPPETIKLOPPKÖPING',
          'SVERIGE',
        ],
      },
      {
        careOf: 'C/o Ronny Maräng',
        street: 'Svissgatan 22',
        zipCode: '600 12',
        city: 'KLOPPETIKLOPPKÖPING',
        country: 'SVERIGE',
        full: 'C/o Ronny Maräng, Svissgatan 22, 600 12, KLOPPETIKLOPPKÖPING, SVERIGE',
      },
    ],
    [
      {
        lines: ['c/o B.ergsäker Granitg.55', null, '720 20', 'Västerås'],
      },
      {
        careOf: 'c/o B.ergsäker',
        street: 'Granitg.55',
        zipCode: '720 20',
        city: 'Västerås',
        full: 'c/o B.ergsäker Granitg.55, 720 20, Västerås',
        country: '',
      },
    ],
  ] as AddressTestCase[])(
    'should process "%o" and extract address "%s"',
    (input, expected) => {
      const dbAddress = {
        addressId: 'wtfever',
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

      expect(extractAddress(dbAddress)).toEqual(expected)
    }
  )
})

describe('parseCareOf', () => {
  it.each([
    ['c/o Ronny Maräng', { careOf: 'c/o Ronny Maräng' }],
    ['C/O Ronny Maräng', { careOf: 'C/O Ronny Maräng' }],
    [
      'c/o B.ergsäker Granitg.22',
      { careOf: 'c/o B.ergsäker', street: 'Granitg.22' },
    ],
    [
      'c/oOM Korvstad Snusmumrikg12',
      { careOf: 'c/o OM Korvstad', street: 'Snusmumrikg12' },
    ],
    [
      'c/o Baloo, Djungelbokv 370',
      { careOf: 'c/o Baloo', street: 'Djungelbokv 370' },
    ],
    [
      'c/o E Dumbom/Mistlursg. 35',
      {
        careOf: 'c/o E Dumbom',
        street: 'Mistlursg. 35',
      },
    ],
    [
      'c/o B O Burkmat, Glasskioskvägen 7',
      {
        careOf: 'c/o B O Burkmat',
        street: 'Glasskioskvägen 7',
      },
    ],
    [
      'c/o A. Grumh Flygplansg. 41',
      {
        careOf: 'c/o A. Grumh',
        street: 'Flygplansg. 41',
      },
    ],
    [
      'Plumsv. 7 c/o Gottlieb',
      {
        careOf: 'c/o Gottlieb',
        street: 'Plumsv. 7',
      },
    ],
    [
      'c/o  Efternamn Gatgatan 5',
      {
        careOf: 'c/o Efternamn',
        street: 'Gatgatan 5',
      },
    ],
  ])('should parse "%s" and yield %o', (input, expected) => {
    expect(parseCareOf(input)).toEqual(expected)
  })
})
