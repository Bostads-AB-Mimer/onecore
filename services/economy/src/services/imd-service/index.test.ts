import assert from 'node:assert'

jest.mock('@src/services/common/adapters/xpand-db-adapter', () => ({
  getActiveLeasesByRentalObjectCodes: jest.fn(),
}))

import { getActiveLeasesByRentalObjectCodes } from '@src/services/common/adapters/xpand-db-adapter'
import { imdService } from '.'

const mockGetActiveLeases =
  getActiveLeasesByRentalObjectCodes as jest.MockedFunction<
    typeof getActiveLeasesByRentalObjectCodes
  >

const csv = `
306-008-01-0201;2026-01-01;2026-01-31;VV;129,312;136,892;7,580;621,680;;82,016;m3;;;1
306-008-01-0202;2026-01-01;2026-01-31;VV;50,608;52,702;2,094;171,740;;82,016;m3;;;1
306-008-01-0203;2026-01-01;2026-01-31;VV;16,893;17,682;0,789;64,710;;82,016;m3;;;1
`

describe(imdService.parseCsv, () => {
  it('parses csv', () => {
    const result = imdService.parseCsv(csv)
    assert(result.ok)

    expect(() =>
      imdService.IMDRowSchema.array().parse(result.data)
    ).not.toThrow()
  })
})

describe(imdService.enrichIMDRows, () => {
  beforeEach(() => {
    mockGetActiveLeases.mockReset()
  })

  it('maps lease ids to rows by rental object code', async () => {
    mockGetActiveLeases.mockResolvedValue(
      new Map<string, string | null>([
        ['306-008-01-0201', '306-008-01-0201/02'],
        ['306-008-01-0202', '306-008-01-0202/01'],
      ])
    )

    const result = await imdService.enrichIMDRows([
      {
        rentalObjectCode: '306-008-01-0201',
        from: new Date('2026-01-01'),
        to: new Date('2026-01-31'),
        unit: 'VV',
        volume: 7.58,
        cost: 621.68,
        measurementUnit: 'm3',
      },
      {
        rentalObjectCode: '306-008-01-0202',
        from: new Date('2026-01-01'),
        to: new Date('2026-01-31'),
        unit: 'VV',
        volume: 2.094,
        cost: 171.74,
        measurementUnit: 'm3',
      },
    ])

    assert(result.ok)
    expect(result.data.unmatched).toHaveLength(0)
    expect(result.data.enriched).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rentalObjectCode: '306-008-01-0201',
          leaseId: '306-008-01-0201/02',
        }),
        expect.objectContaining({
          rentalObjectCode: '306-008-01-0202',
          leaseId: '306-008-01-0202/01',
        }),
      ])
    )
  })

  it('tags unmatched row as no-active-lease when rental object exists but has no lease', async () => {
    mockGetActiveLeases.mockResolvedValue(
      new Map<string, string | null>([
        ['306-008-01-0201', '306-008-01-0201/02'],
        ['306-008-01-0299', null],
      ])
    )

    const result = await imdService.enrichIMDRows([
      {
        rentalObjectCode: '306-008-01-0201',
        from: new Date('2026-01-01'),
        to: new Date('2026-01-31'),
        unit: 'VV',
        volume: 7.58,
        cost: 621.68,
        measurementUnit: 'm3',
      },
      {
        rentalObjectCode: '306-008-01-0299',
        from: new Date('2026-01-01'),
        to: new Date('2026-01-31'),
        unit: 'VV',
        volume: 3.0,
        cost: 250.0,
        measurementUnit: 'm3',
      },
    ])

    assert(result.ok)
    expect(result.data.enriched).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rentalObjectCode: '306-008-01-0201',
          leaseId: '306-008-01-0201/02',
        }),
      ])
    )
    expect(result.data.unmatched).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rentalObjectCode: '306-008-01-0299',
          reason: 'no-active-lease',
        }),
      ])
    )
  })

  it('tags unmatched row as no-rental-object when code is absent from results', async () => {
    mockGetActiveLeases.mockResolvedValue(new Map<string, string | null>())

    const result = await imdService.enrichIMDRows([
      {
        rentalObjectCode: 'DOES-NOT-EXIST',
        from: new Date('2026-01-01'),
        to: new Date('2026-01-31'),
        unit: 'VV',
        volume: 7.58,
        cost: 621.68,
        measurementUnit: 'm3',
      },
    ])

    assert(result.ok)
    expect(result.data.enriched).toHaveLength(0)
    expect(result.data.unmatched).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rentalObjectCode: 'DOES-NOT-EXIST',
          reason: 'no-rental-object',
        }),
      ])
    )
  })

  it('returns error when adapter throws', async () => {
    mockGetActiveLeases.mockRejectedValue(new Error('db connection failed'))

    const result = await imdService.enrichIMDRows([
      {
        rentalObjectCode: '306-008-01-0201',
        from: new Date('2026-01-01'),
        to: new Date('2026-01-31'),
        unit: 'VV',
        volume: 7.58,
        cost: 621.68,
        measurementUnit: 'm3',
      },
    ])

    expect(result.ok).toBe(false)
  })
})

const makeEnrichedRow = (
  rentalObjectCode: string,
  leaseId: string,
  { cost = 100, unit = 'VV', measurementUnit = 'm3' } = {}
) => ({
  rentalObjectCode,
  leaseId,
  from: new Date('2026-01-01'),
  to: new Date('2026-01-31'),
  unit,
  volume: 7.58,
  cost,
  measurementUnit,
})

describe(imdService.toTenfastCsv, () => {
  it('maps VV to IMDM article and builds Avitext with Varmvatten', () => {
    const csv = imdService.toTenfastCsv([
      makeEnrichedRow('306-008-01-0201', '306-008-01-0201/02', { cost: 621.68, unit: 'VV' }),
    ])

    const lines = csv.split('\n')
    expect(lines[0]).toBe(
      'Kontraktsnummer;Hyresartikel;Avitext;Fr.o.m;T.o.m;Årshyra'
    )
    expect(lines[1]).toBe(
      '306-008-01-0201/02;IMDM;Varmvatten januari,7,58,m3(25% moms tillkommer);2026-01-01;2026-01-31;7460,16'
    )
  })

  it('maps VMM to VÄRMEENERGIM article and builds Avitext with Värmeenergi', () => {
    const csv = imdService.toTenfastCsv([
      makeEnrichedRow('306-008-01-0201', 'L1', { cost: 500, unit: 'VMM' }),
    ])

    const dataLine = csv.split('\n')[1]
    const cols = dataLine.split(';')
    expect(cols[1]).toBe('VÄRMEENERGIM')
    expect(cols[2]).toBe('Värmeenergi januari,7,58,m3(25% moms tillkommer)')
  })

  it('throws for unknown unit', () => {
    expect(() =>
      imdService.toTenfastCsv([
        makeEnrichedRow('306-008-01-0201', 'L1', { unit: 'UNKNOWN' }),
      ])
    ).toThrow('Unknown unit "UNKNOWN"')
  })

  it('multiplies monthly cost by 12 for yearly rent', () => {
    const csv = imdService.toTenfastCsv([
      makeEnrichedRow('306-008-01-0201', 'L1', { cost: 500 }),
    ])

    const dataLine = csv.split('\n')[1]
    const yearlyRent = dataLine.split(';')[5]
    expect(yearlyRent).toBe('6000,00')
  })

  it('outputs multiple rows', () => {
    const csv = imdService.toTenfastCsv([
      makeEnrichedRow('306-008-01-0201', 'L1', { cost: 100 }),
      makeEnrichedRow('306-008-01-0202', 'L2', { cost: 200 }),
    ])

    const lines = csv.split('\n')
    expect(lines).toHaveLength(3)
  })
})
