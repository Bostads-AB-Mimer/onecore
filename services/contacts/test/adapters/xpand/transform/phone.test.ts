import { extractPhoneNumber, extractPhoneNumberComment } from '@xpand/transform'

describe('extractPhoneNumber', () => {
  it.each([
    ['0700098811', [{ extracted: '0700098811' }]],
    ['    0700098811', [{ extracted: '0700098811' }]],
    ['0700098811    ', [{ extracted: '0700098811' }]],
    ['100-212 07 , "                ', [{ extracted: '100-212 07' }]],
    ['540-201277, "                 ', [{ extracted: '540-201277' }]],
    [
      '021.348927                    ',
      [{ extracted: '021-348927', literal: '021.348927' }],
    ],
    [
      '073´3433162                   ',
      [{ extracted: '073-3433162', literal: '073´3433162' }],
    ],
    ['0006308018,,                  ', [{ extracted: '0006308018' }]],
    ['Dottern Ingrid: 0700098811    ', [{ extracted: '0700098811' }]],
    ['+44(6)188-3418921             ', [{ extracted: '+44(6)188-3418921' }]],
    ['+46 (8)1 888 63 961           ', [{ extracted: '+46 (8)1 888 63 961' }]],
    // Note: U+00A0 / non-breaking space in input
    [
      '+44 7976 404854               ',
      [{ extracted: '+44 7976 404854', literal: '+44 7976 404854' }],
    ],
    ['+46 (66) 9482481              ', [{ extracted: '+46 (66) 9482481' }]],
    ['+46 (2)78-343 77 22           ', [{ extracted: '+46 (2)78-343 77 22' }]],
    // Note: U+00A0 / non-breaking space in input
    [
      '+46 14 091 69 91              ',
      [{ extracted: '+46 14 091 69 91', literal: '+46 14 091 69 91' }],
    ],
    ['07277288;                     ', [{ extracted: '07277288' }]],
    [
      '+44 9254 167498+27 9254 167498',
      [{ extracted: '+44 9254 167498' }, { extracted: '+27 9254 167498' }],
    ],
    ['(843) 0988381                 ', [{ extracted: '(843) 0988381' }]],
    [
      '073-7552752, 7514577552       ',
      [{ extracted: '073-7552752' }, { extracted: '7514577552' }],
    ],
    [
      '´0221-80 115, 114 81          ',
      [
        { extracted: '0221-80 115' },
        { extracted: '0221-114 81', literal: '114 81' },
      ],
    ],
    [
      '0734-302243, 1816145302       ',
      [{ extracted: '0734-302243' }, { extracted: '1816145302' }],
    ],
    [
      '0736837911, 9392276837        ',
      [{ extracted: '0736837911' }, { extracted: '9392276837' }],
    ],
    [
      '0792212127 ,  3139221212      ',
      [{ extracted: '0792212127' }, { extracted: '3139221212' }],
    ],
    [
      '076 - 9260411, 9569192604     ',
      [{ extracted: '076 - 9260411' }, { extracted: '9569192604' }],
    ],
    [
      '0706246528, 153204624         ',
      [{ extracted: '0706246528' }, { extracted: '153204624' }],
    ],
    [
      '0736961340,0778188696         ',
      [{ extracted: '0736961340' }, { extracted: '0778188696' }],
    ],
    ['073#625642                    ', [{ extracted: '073#625642' }]],
    ['0729113#17                    ', [{ extracted: '0729113' }]],
    [
      '021-736225/394326             ',
      [
        { extracted: '021-736225' },
        { extracted: '021-394326', literal: '394326' },
      ],
    ],
    [
      ' 0227-14139/27812             ',
      [
        { extracted: '0227-14139' },
        { extracted: '0227-27812', literal: '27812' },
      ],
    ],
    [
      '021-353 51/19                 ',
      [{ extracted: '021-353 51' }, { extracted: '021-353 19', literal: '19' }],
    ],
    [
      '0223-762678/ 651533           ',
      [
        { extracted: '0223-762678' },
        { extracted: '0223-651533', literal: '651533' },
      ],
    ],
    [
      '0707258063-/0705672580        ',
      [{ extracted: '0707258063' }, { extracted: '0705672580' }],
    ],
    [
      '070-015 96 97/0704015396      ',
      [{ extracted: '070-015 96 97' }, { extracted: '0704015396' }],
    ],
    // Note: U+00A0 / non-breaking space in input
    [
      '073694 89 09                  ',
      [{ extracted: '073694 89 09', literal: '073694 89 09' }],
    ],
    [
      '073-0042430, 515 400 24 04    ',
      [{ extracted: '073-0042430' }, { extracted: '515 400 24 04' }],
    ],
    ['0707-839724.                  ', [{ extracted: '0707-839724' }]],
    ['9:30                          ', []],
    ['2*90427064                    ', [{ extracted: '2*90427064' }]],
    ['046-(0)227424901              ', [{ extracted: '046-(0)227424901' }]],
    ['0213*5842                     ', [{ extracted: '0213*5842' }]],
    [
      '076-230 12 00 +4672-302 26 06 ',
      [{ extracted: '076-230 12 00' }, { extracted: '+4672-302 26 06' }],
    ],
    ['Christer 073-11122333', [{ extracted: '073-11122333' }]],
    ['Christer 0731112233           ', [{ extracted: '0731112233' }]],
    ['       070-1943334 (Maud)     ', [{ extracted: '070-1943334' }]],
    ['      021-110033 Björn        ', [{ extracted: '021-110033' }]],
    ['?021-39 92 20?                ', [{ extracted: '021-39 92 20' }]],
    ['??076-166 57 65??             ', [{ extracted: '076-166 57 65' }]],
    ['??+46 80 078 93 55??          ', [{ extracted: '+46 80 078 93 55' }]],
    ['?+46 17-882 26 75?            ', [{ extracted: '+46 17-882 26 75' }]],
    // Note: U+00A0 / non-breaking space in input
    [
      '?+46 73 746 12 33?            ',
      [{ extracted: '+46 73 746 12 33', literal: '+46 73 746 12 33' }],
    ],
    // Note: U+00A0 / non-breaking space in input
    [
      '120-165 14 20                 ',
      [{ extracted: '120-165 14 20', literal: '120-165 14 20' }],
    ],
    ['120-165 14 20                 ', [{ extracted: '120-165 14 20' }]],
    [
      '073-3986887, 0762234497       ',
      [{ extracted: '073-3986887' }, { extracted: '0762234497' }],
    ],
    ['  På en grusväg               ', []],
  ])('should process "%s" and extract phone number "%s"', (input, expected) => {
    expect(extractPhoneNumber(input)).toEqual(expected)
  })

  type CommentTestCase = [[string, string | undefined], string | undefined]

  it.each([
    [['0700098811', '0700098811'], undefined],
    [['    0700098811', '0700098811'], undefined],
    [['0700098811    ', '0700098811'], undefined],
    [['Dottern Ingrid: 0700098811    ', '0700098811'], 'Dottern Ingrid'],
    [['Dottern:Ingrid: 0700098811    ', '0700098811'], 'Dottern:Ingrid'],
    [
      ['Dottern Ingrid: 0700098811 Hemnummer', '0700098811'],
      'Dottern Ingrid, Hemnummer',
    ],
    [['Christer 073-11122333', '073-11122333'], 'Christer'],
    [['Christer 0701112233           ', '0701112233'], 'Christer'],
    [['       070-1943334 (Maud)     ', '070-1943334'], '(Maud)'],
    [['      021-110033 Björn        ', '021-110033'], 'Björn'],
    [['  På en grusväg               ', undefined], 'På en grusväg'],
  ] as CommentTestCase[])(
    'should process "%s" and extract comment "%s"',
    ([rawInput, numberPart], expected) => {
      expect(extractPhoneNumberComment(rawInput, numberPart)).toEqual(expected)
    }
  )
})
