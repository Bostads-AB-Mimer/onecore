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
    [
      {
        lines: ['Testgatan 18', null, '123 45', 'ÖREBRO', 'SVERIGE'],
      },
      {
        street: 'Testgatan 18',
        zipCode: '123 45',
        city: 'ÖREBRO',
        country: 'SVERIGE',
        full: 'Testgatan 18, 123 45, ÖREBRO, SVERIGE',
      },
    ],
    [
      {
        lines: ['Testvägen 1', null, '184 30', 'ÅKERSBERGA'],
      },
      {
        street: 'Testvägen 1',
        zipCode: '184 30',
        city: 'ÅKERSBERGA',
        country: '',
        full: 'Testvägen 1, 184 30, ÅKERSBERGA',
      },
    ],
    [
      {
        lines: ['Teststrasse 1', null, '1010', 'WIEN', 'ÖSTERRIKE'],
      },
      {
        street: 'Teststrasse 1',
        zipCode: '1010',
        city: 'WIEN',
        country: 'ÖSTERRIKE',
        full: 'Teststrasse 1, 1010, WIEN, ÖSTERRIKE',
      },
    ],
    [
      {
        lines: ['Testgatan 2', null, '723 40', 'älvsjö', 'sverige'],
      },
      {
        street: 'Testgatan 2',
        zipCode: '723 40',
        city: 'älvsjö',
        country: 'sverige',
        full: 'Testgatan 2, 723 40, älvsjö, sverige',
      },
    ],
    [
      {
        lines: ['Testgatan 1', null, '123 45', '2 tr', 'ÖREBRO', 'SVERIGE'],
      },
      {
        street: 'Testgatan 1',
        zipCode: '123 45',
        city: 'ÖREBRO',
        country: 'SVERIGE',
        full: 'Testgatan 1, 123 45, 2 tr, ÖREBRO, SVERIGE',
      },
    ],
    [
      {
        lines: ['Testgatan 3', null, '123 45', '"ÖREBRO', 'SVERIGE'],
      },
      {
        street: 'Testgatan 3',
        zipCode: '123 45',
        city: 'ÖREBRO',
        country: 'SVERIGE',
        full: 'Testgatan 3, 123 45, "ÖREBRO, SVERIGE',
      },
    ],
    [
      {
        lines: ['Testgatan 4', null, '123 45', '(Älvsjö)', 'SVERIGE'],
      },
      {
        street: 'Testgatan 4',
        zipCode: '123 45',
        city: 'Älvsjö',
        country: 'SVERIGE',
        full: 'Testgatan 4, 123 45, (Älvsjö), SVERIGE',
      },
    ],
    [
      {
        lines: ['Testgatan 5', null, '123 45', '-ÖREBRO', 'SVERIGE'],
      },
      {
        street: 'Testgatan 5',
        zipCode: '123 45',
        city: 'ÖREBRO',
        country: 'SVERIGE',
        full: 'Testgatan 5, 123 45, -ÖREBRO, SVERIGE',
      },
    ],
    [
      {
        lines: ['Testgatan 6', null, '123 45', '-', 'VÄSTERÅS', 'SVERIGE'],
      },
      {
        street: 'Testgatan 6',
        zipCode: '123 45',
        city: 'VÄSTERÅS',
        country: 'SVERIGE',
        full: 'Testgatan 6, 123 45, -, VÄSTERÅS, SVERIGE',
      },
    ],
    [
      {
        lines: ['Testgatan 7', null, '72345', '72345 VÄSTERÅS', 'SVERIGE'],
      },
      {
        street: 'Testgatan 7',
        zipCode: '72345',
        city: 'VÄSTERÅS',
        country: 'SVERIGE',
        full: 'Testgatan 7, 72345, 72345 VÄSTERÅS, SVERIGE',
      },
    ],
    [
      {
        lines: ['Testgatan 8', null, '723 45', '723 45 Västerås', 'SVERIGE'],
      },
      {
        street: 'Testgatan 8',
        zipCode: '723 45',
        city: 'Västerås',
        country: 'SVERIGE',
        full: 'Testgatan 8, 723 45, 723 45 Västerås, SVERIGE',
      },
    ],
    [
      {
        lines: ['Testgatan 9', null, '72345', '72345', 'SVERIGE'],
      },
      {
        street: 'Testgatan 9',
        zipCode: '72345',
        city: '',
        country: 'SVERIGE',
        full: 'Testgatan 9, 72345, 72345, SVERIGE',
      },
    ],
    [
      {
        lines: ['Testgatan 10', null, '123 45', 'SVERIGE'],
      },
      {
        street: 'Testgatan 10',
        zipCode: '123 45',
        city: '',
        country: 'SVERIGE',
        full: 'Testgatan 10, 123 45, SVERIGE',
      },
    ],
    [
      {
        lines: ['Testgatan 11', null, '123 45', 'sweden'],
      },
      {
        street: 'Testgatan 11',
        zipCode: '123 45',
        city: '',
        country: 'sweden',
        full: 'Testgatan 11, 123 45, sweden',
      },
    ],
    [
      {
        lines: ['Testgatan 12', null, '123 45', 'Stockholm (Testby)', 'SVERIGE'],
      },
      {
        street: 'Testgatan 12',
        zipCode: '123 45',
        city: 'Stockholm (Testby)',
        country: 'SVERIGE',
        full: 'Testgatan 12, 123 45, Stockholm (Testby), SVERIGE',
      },
    ],
    [
      {
        lines: ['Testgatan 13', null, '123 45', 'TESTBY', 'Korea (Rep.)'],
      },
      {
        street: 'Testgatan 13',
        zipCode: '123 45',
        city: 'TESTBY',
        country: 'Korea (Rep.)',
        full: 'Testgatan 13, 123 45, TESTBY, Korea (Rep.)',
      },
    ],
    [
      {
        lines: ['Teststrasse 1', null, '1010', '1010 WIEN', 'ÖSTERRIKE'],
      },
      {
        street: 'Teststrasse 1',
        zipCode: '1010',
        city: 'WIEN',
        country: 'ÖSTERRIKE',
        full: 'Teststrasse 1, 1010, 1010 WIEN, ÖSTERRIKE',
      },
    ],
    [
      {
        lines: ['Testveien 1', null, '0150', '0150 OSLO', 'NORGE'],
      },
      {
        street: 'Testveien 1',
        zipCode: '0150',
        city: 'OSLO',
        country: 'NORGE',
        full: 'Testveien 1, 0150, 0150 OSLO, NORGE',
      },
    ],
    [
      {
        lines: ['Testgatan 14', null, '123 45', '"ÖREBRO"', 'SVERIGE'],
      },
      {
        street: 'Testgatan 14',
        zipCode: '123 45',
        city: 'ÖREBRO',
        country: 'SVERIGE',
        full: 'Testgatan 14, 123 45, "ÖREBRO", SVERIGE',
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
