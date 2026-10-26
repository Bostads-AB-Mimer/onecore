import assert from 'node:assert'
import { economy } from '@onecore/types'
import type {
  LeaseMatch,
  MultipleLeaseMatch,
  TenantLease,
} from '@src/common/adapters/tenfast/tenfast-adapter'

jest.mock('@src/common/adapters/tenfast/tenfast-adapter', () => ({
  getActiveLeasesByRentalObjectCodes: jest.fn(),
  getLeasesByTenantId: jest.fn(),
}))

import {
  getActiveLeasesByRentalObjectCodes,
  getLeasesByTenantId,
} from '@src/common/adapters/tenfast/tenfast-adapter'
import { imdService } from '.'

const mockGetActiveLeases =
  getActiveLeasesByRentalObjectCodes as jest.MockedFunction<
    typeof getActiveLeasesByRentalObjectCodes
  >
const mockGetLeasesByTenantId = getLeasesByTenantId as jest.MockedFunction<
  typeof getLeasesByTenantId
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

    expect(() => economy.IMDRowSchema.array().parse(result.data)).not.toThrow()
  })

  it('returns invalid-csv when rows have different periods', () => {
    const mixedPeriodCsv = `
306-008-01-0201;2026-01-01;2026-01-31;VV;129,312;136,892;7,580;621,680;;82,016;m3;;;1
306-008-01-0202;2026-02-01;2026-02-28;VV;50,608;52,702;2,094;171,740;;82,016;m3;;;1
`
    const result = imdService.parseCsv(mixedPeriodCsv)
    expect(result.ok).toBe(false)
  })
})

describe(imdService.enrichIMDRows, () => {
  beforeEach(() => {
    mockGetActiveLeases.mockReset()
  })

  it('maps lease ids to rows by rental object code', async () => {
    mockGetActiveLeases.mockResolvedValue(
      new Map<string, LeaseMatch | null>([
        [
          '306-008-01-0201',
          { leaseId: '306-008-01-0201/02', leaseEndDate: null, tenantIds: [] },
        ],
        [
          '306-008-01-0202',
          { leaseId: '306-008-01-0202/01', leaseEndDate: null, tenantIds: [] },
        ],
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
    expect(result.data.unprocessed).toHaveLength(0)
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

  it('tags row as no-active-lease when rental object exists but has no lease', async () => {
    mockGetActiveLeases.mockResolvedValue(
      new Map<string, LeaseMatch | null>([
        [
          '306-008-01-0201',
          { leaseId: '306-008-01-0201/02', leaseEndDate: null, tenantIds: [] },
        ],
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
    expect(result.data.unprocessed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rentalObjectCode: '306-008-01-0299',
          reason: 'no-active-lease',
        }),
      ])
    )
  })

  it('tags row as no-rental-object when code is absent from results', async () => {
    mockGetActiveLeases.mockResolvedValue(new Map<string, LeaseMatch | null>())

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
    expect(result.data.unprocessed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rentalObjectCode: 'DOES-NOT-EXIST',
          reason: 'no-rental-object',
        }),
      ])
    )
  })

  it('tags row as amount-too-low when cost is under 15', async () => {
    mockGetActiveLeases.mockResolvedValue(
      new Map<string, LeaseMatch | null>([
        [
          '306-008-01-0201',
          { leaseId: '306-008-01-0201/02', leaseEndDate: null, tenantIds: [] },
        ],
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
        volume: 0.1,
        cost: 8.2,
        measurementUnit: 'm3',
      },
    ])

    assert(result.ok)
    expect(result.data.enriched).toHaveLength(1)
    expect(result.data.unprocessed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rentalObjectCode: '306-008-01-0202',
          reason: 'amount-too-low',
        }),
      ])
    )
  })

  it('tags row as unsupported-unit when unit has no mapping', async () => {
    mockGetActiveLeases.mockResolvedValue(
      new Map<string, LeaseMatch | null>([
        [
          '306-008-01-0201',
          { leaseId: '306-008-01-0201/02', leaseEndDate: null, tenantIds: [] },
        ],
      ])
    )

    const result = await imdService.enrichIMDRows([
      {
        rentalObjectCode: '306-008-01-0201',
        from: new Date('2026-01-01'),
        to: new Date('2026-01-31'),
        unit: 'UNKNOWN',
        volume: 7.58,
        cost: 621.68,
        measurementUnit: 'kWh',
      },
    ])

    assert(result.ok)
    expect(result.data.enriched).toHaveLength(0)
    expect(result.data.unprocessed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rentalObjectCode: '306-008-01-0201',
          reason: 'unsupported-unit',
        }),
      ])
    )
  })

  const septemberRow = {
    rentalObjectCode: '306-008-01-0201',
    from: new Date('2026-09-01'),
    to: new Date('2026-09-30'),
    unit: 'VV',
    volume: 7.58,
    cost: 621.68,
    measurementUnit: 'm3',
  }

  it.each([
    ['before the billing month', '2026-10-31'],
    ['during the billing month', '2026-11-15'],
  ])('tags row as tenant-moved when lease ends %s', async (_, leaseEndDate) => {
    mockGetActiveLeases.mockResolvedValue(
      new Map<string, LeaseMatch | null>([
        [
          '306-008-01-0201',
          {
            leaseId: '306-008-01-0201/02',
            leaseEndDate: new Date(leaseEndDate),
            tenantIds: [],
          },
        ],
      ])
    )

    const result = await imdService.enrichIMDRows([septemberRow])

    assert(result.ok)
    expect(result.data.enriched).toHaveLength(0)
    expect(result.data.unprocessed).toEqual([
      expect.objectContaining({
        rentalObjectCode: '306-008-01-0201',
        reason: 'tenant-moved',
      }),
    ])
  })

  it('tags row as multiple-leases when two leases cover the period', async () => {
    mockGetActiveLeases.mockResolvedValue(
      new Map<string, LeaseMatch | MultipleLeaseMatch | null>([
        [
          '306-008-01-0201',
          {
            leaseIds: ['306-008-01-0201/01', '306-008-01-0201/02'],
          },
        ],
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
    ])

    assert(result.ok)
    expect(result.data.enriched).toHaveLength(0)
    expect(result.data.unprocessed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rentalObjectCode: '306-008-01-0201',
          reason: 'multiple-leases',
          leaseIds: ['306-008-01-0201/01', '306-008-01-0201/02'],
        }),
      ])
    )
  })

  it.each([
    ['on the last day of the billing month', new Date('2026-11-30')],
    ['after the billing month', new Date('2027-03-31')],
    ['never', null],
  ])(
    'does not tag as tenant-moved when lease ends %s',
    async (_, leaseEndDate) => {
      mockGetActiveLeases.mockResolvedValue(
        new Map<string, LeaseMatch | null>([
          [
            '306-008-01-0201',
            { leaseId: '306-008-01-0201/02', leaseEndDate, tenantIds: [] },
          ],
        ])
      )

      const result = await imdService.enrichIMDRows([septemberRow])

      assert(result.ok)
      expect(result.data.unprocessed).toHaveLength(0)
      expect(result.data.enriched).toEqual([
        expect.objectContaining({
          rentalObjectCode: '306-008-01-0201',
          leaseId: '306-008-01-0201/02',
        }),
      ])
    }
  )

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

  describe("moving rows to the tenant's new lease", () => {
    const oldLeaseId = '306-008-01-0501/04'
    const newLeaseId = '306-008-01-0302/12'

    const makeRow = (rentalObjectCode = '306-008-01-0501', unit = 'VV') => ({
      rentalObjectCode,
      from: new Date('2026-09-01'),
      to: new Date('2026-09-30'),
      unit,
      volume: 7.58,
      cost: 621.68,
      measurementUnit: 'm3',
    })

    // Tenants usually keep the old home for a while after moving in, so the
    // new lease overlaps the old one by default.
    const makeTenantLease = (overrides: Partial<TenantLease>): TenantLease => ({
      leaseId: newLeaseId,
      stage: 'active',
      startDate: new Date('2026-09-01'),
      endDate: null,
      isResidential: true,
      ...overrides,
    })

    const oldLease = makeTenantLease({
      leaseId: oldLeaseId,
      stage: 'terminationScheduled',
      startDate: new Date('2020-01-01'),
      endDate: new Date('2026-10-31'),
    })
    const newLease = makeTenantLease({})

    const mockOldLease = (tenantIds = ['tenant-1']) =>
      mockGetActiveLeases.mockResolvedValue(
        new Map<string, LeaseMatch | null>([
          [
            '306-008-01-0501',
            {
              leaseId: oldLeaseId,
              leaseEndDate: new Date('2026-10-31'),
              tenantIds,
            },
          ],
        ])
      )

    beforeEach(() => {
      mockGetLeasesByTenantId.mockReset()
    })

    it.each([
      ['overlaps the old one', newLease],
      [
        'starts with the billing month',
        makeTenantLease({
          stage: 'upcoming',
          startDate: new Date('2026-11-01'),
        }),
      ],
    ])(
      'moves the row to the new residential lease when it %s',
      async (_, lease) => {
        mockOldLease()
        mockGetLeasesByTenantId.mockResolvedValue({
          ok: true,
          data: [oldLease, lease],
        })

        const result = await imdService.enrichIMDRows([makeRow()])

        assert(result.ok)
        expect(mockGetLeasesByTenantId).toHaveBeenCalledWith('tenant-1')
        expect(result.data.unprocessed).toHaveLength(0)
        expect(result.data.enriched).toEqual([
          expect.objectContaining({
            rentalObjectCode: '306-008-01-0501',
            leaseId: newLeaseId,
          }),
        ])
        expect(result.data.enriched[0]).not.toHaveProperty('reason')
      }
    )

    it('looks up each tenant once and moves all their rows', async () => {
      mockOldLease()
      mockGetLeasesByTenantId.mockResolvedValue({
        ok: true,
        data: [oldLease, newLease],
      })

      const result = await imdService.enrichIMDRows([
        makeRow('306-008-01-0501', 'VV'),
        makeRow('306-008-01-0501', 'EL'),
      ])

      assert(result.ok)
      expect(mockGetLeasesByTenantId).toHaveBeenCalledTimes(1)
      expect(result.data.unprocessed).toHaveLength(0)
      expect(result.data.enriched.map((row) => row.leaseId)).toEqual([
        newLeaseId,
        newLeaseId,
      ])
    })

    it.each<
      [string, Parameters<typeof mockGetLeasesByTenantId.mockResolvedValue>[0]]
    >([
      ['the tenant has no other lease', { ok: true, data: [oldLease] }],
      [
        'the only other lease is not residential',
        {
          ok: true,
          data: [oldLease, makeTenantLease({ isResidential: false })],
        },
      ],
      [
        'the new lease is not signed yet',
        {
          ok: true,
          data: [oldLease, makeTenantLease({ stage: 'signingInProgress' })],
        },
      ],
      [
        'the new lease is voided',
        { ok: true, data: [oldLease, makeTenantLease({ stage: 'voided' })] },
      ],
      [
        'the new lease starts during the billing month',
        {
          ok: true,
          data: [
            oldLease,
            makeTenantLease({ startDate: new Date('2026-11-15') }),
          ],
        },
      ],
      [
        'the new lease ends during the billing month',
        {
          ok: true,
          data: [
            oldLease,
            makeTenantLease({ endDate: new Date('2026-11-15') }),
          ],
        },
      ],
      [
        'several residential leases cover the billing month',
        {
          ok: true,
          data: [
            oldLease,
            newLease,
            makeTenantLease({ leaseId: '306-008-01-0303/01', stage: 'active' }),
          ],
        },
      ],
      [
        'the old lease is not residential',
        {
          ok: true,
          data: [{ ...oldLease, isResidential: false }, newLease],
        },
      ],
      [
        "the old lease is missing from the tenant's leases",
        { ok: true, data: [newLease] },
      ],
      ['the lookup fails', { ok: false, err: 'unknown' }],
    ])('keeps the row as tenant-moved when %s', async (_, tenantLeases) => {
      mockOldLease()
      mockGetLeasesByTenantId.mockResolvedValue(tenantLeases)

      const result = await imdService.enrichIMDRows([makeRow()])

      assert(result.ok)
      expect(result.data.enriched).toHaveLength(0)
      expect(result.data.unprocessed).toEqual([
        expect.objectContaining({ reason: 'tenant-moved' }),
      ])
    })

    it('keeps the row as tenant-moved without lookup when the lease has several tenants', async () => {
      mockOldLease(['tenant-1', 'tenant-2'])

      const result = await imdService.enrichIMDRows([makeRow()])

      assert(result.ok)
      expect(mockGetLeasesByTenantId).not.toHaveBeenCalled()
      expect(result.data.unprocessed).toEqual([
        expect.objectContaining({ reason: 'tenant-moved' }),
      ])
    })

    it('keeps the row as tenant-moved without lookup when the unit is unsupported', async () => {
      mockOldLease()

      const result = await imdService.enrichIMDRows([
        makeRow('306-008-01-0501', 'UNKNOWN'),
      ])

      assert(result.ok)
      expect(mockGetLeasesByTenantId).not.toHaveBeenCalled()
      expect(result.data.unprocessed).toEqual([
        expect.objectContaining({ reason: 'tenant-moved' }),
      ])
    })

    // With overlapping leases the new home has its own rows for the same
    // month. Until we know the Tenfast import keeps two rows with the same
    // article on one lease, the moved row of that article is left manual.
    it('keeps the row as tenant-moved when the new home already has a row with the same article', async () => {
      mockGetActiveLeases.mockResolvedValue(
        new Map<string, LeaseMatch | null>([
          [
            '306-008-01-0501',
            {
              leaseId: oldLeaseId,
              leaseEndDate: new Date('2026-10-31'),
              tenantIds: ['tenant-1'],
            },
          ],
          [
            '306-008-01-0302',
            {
              leaseId: newLeaseId,
              leaseEndDate: null,
              tenantIds: ['tenant-1'],
            },
          ],
        ])
      )
      mockGetLeasesByTenantId.mockResolvedValue({
        ok: true,
        data: [oldLease, newLease],
      })

      const result = await imdService.enrichIMDRows([
        makeRow('306-008-01-0501', 'VV'),
        makeRow('306-008-01-0302', 'VV'),
        makeRow('306-008-01-0501', 'VMM'),
      ])

      assert(result.ok)
      expect(result.data.enriched).toEqual([
        expect.objectContaining({
          rentalObjectCode: '306-008-01-0302',
          unit: 'VV',
          leaseId: newLeaseId,
        }),
        expect.objectContaining({
          rentalObjectCode: '306-008-01-0501',
          unit: 'VMM',
          leaseId: newLeaseId,
        }),
      ])
      expect(result.data.unprocessed).toEqual([
        expect.objectContaining({
          rentalObjectCode: '306-008-01-0501',
          unit: 'VV',
          reason: 'tenant-moved',
        }),
      ])
    })
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

// Parse a single RFC 4180 CSV line into fields
function parseRow(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields
}

describe(imdService.toTenfastCsv, () => {
  it('maps VV to IMDM article and builds Avitext with Varmvatten', () => {
    const csv = imdService.toTenfastCsv([
      makeEnrichedRow('306-008-01-0201', '306-008-01-0201/02', {
        cost: 621.68,
        unit: 'VV',
      }),
    ])

    const lines = csv.split('\n')
    expect(lines[0]).toBe(
      'Kontraktsnummer,Hyresartikel,Avitext,Fr.o.m,T.o.m,Årshyra,Summarad'
    )
    const cols = parseRow(lines[1])
    expect(cols[0]).toBe('306-008-01-0201/02')
    expect(cols[1]).toBe('IMDM')
    expect(cols[2]).toBe('Varmvatten januari,7,58,m3(25% moms tillkommer)')
    expect(cols[3]).toBe('2026-03-01')
    expect(cols[4]).toBe('2026-03-31')
    expect(cols[5]).toBe('7460,16')
    expect(cols[6]).toBe('')
  })

  it('maps ELEC to IMDELM article and builds Avitext with El', () => {
    const csv = imdService.toTenfastCsv([
      makeEnrichedRow('306-008-01-0201', 'L1', { cost: 500, unit: 'ELEC' }),
    ])

    const cols = parseRow(csv.split('\n')[1])
    expect(cols[1]).toBe('IMDELM')
    expect(cols[2]).toBe('El januari,7,58,m3(25% moms tillkommer)')
  })

  it('maps EL to IMDELM article and builds Avitext with Elförbrukning', () => {
    const row = makeEnrichedRow('306-008-01-0201', 'L1', {
      cost: 26.82,
      unit: 'EL',
    })
    row.from = new Date('2026-08-01')
    row.to = new Date('2026-08-31')
    row.volume = 15
    row.measurementUnit = 'kWh'

    const cols = parseRow(imdService.toTenfastCsv([row]).split('\n')[1])
    expect(cols[1]).toBe('IMDELM')
    expect(cols[2]).toBe('Elförbrukning augusti,15,kWh(25% moms tillkommer)')
    expect(cols[5]).toBe('321,84')
  })

  it('maps VMM to VÄRMEENERGIM article and builds Avitext with Värmeenergi', () => {
    const csv = imdService.toTenfastCsv([
      makeEnrichedRow('306-008-01-0201', 'L1', { cost: 500, unit: 'VMM' }),
    ])

    const cols = parseRow(csv.split('\n')[1])
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

    const cols = parseRow(csv.split('\n')[1])
    expect(cols[5]).toBe('6000,00')
  })

  it('handles mixed VV and VMM rows', () => {
    const csv = imdService.toTenfastCsv([
      makeEnrichedRow('306-008-01-0201', 'L1', { cost: 100, unit: 'VV' }),
      makeEnrichedRow('306-008-01-0202', 'L2', { cost: 200, unit: 'VMM' }),
    ])

    const lines = csv.split('\n')
    expect(lines).toHaveLength(3)

    const vvCols = parseRow(lines[1])
    expect(vvCols[1]).toBe('IMDM')
    expect(vvCols[2]).toContain('Varmvatten')

    const vmmCols = parseRow(lines[2])
    expect(vmmCols[1]).toBe('VÄRMEENERGIM')
    expect(vmmCols[2]).toContain('Värmeenergi')
  })

  it('outputs multiple rows', () => {
    const csv = imdService.toTenfastCsv([
      makeEnrichedRow('306-008-01-0201', 'L1', { cost: 100 }),
      makeEnrichedRow('306-008-01-0202', 'L2', { cost: 200 }),
    ])

    const lines = csv.split('\n')
    expect(lines).toHaveLength(3)
  })

  it('sets Fr.o.m/T.o.m to consumption period plus two months for Tenfast billing', () => {
    const row = makeEnrichedRow('306-008-01-0201', '306-008-01-0201/06', {
      cost: 4710.36,
      unit: 'VV',
    })
    row.from = new Date('2026-09-01')
    row.to = new Date('2026-09-30')

    const cols = parseRow(imdService.toTenfastCsv([row]).split('\n')[1])
    expect(cols[2]).toBe('Varmvatten september,7,58,m3(25% moms tillkommer)')
    expect(cols[3]).toBe('2026-11-01')
    expect(cols[4]).toBe('2026-11-30')
  })
})

const makeUnprocessedRow = (
  rentalObjectCode: string,
  reason:
    | 'no-rental-object'
    | 'no-active-lease'
    | 'amount-too-low'
    | 'unsupported-unit',
  { cost = 100, unit = 'VV', measurementUnit = 'm3' } = {}
) => ({
  rentalObjectCode,
  from: new Date('2026-01-01'),
  to: new Date('2026-01-31'),
  unit,
  volume: 7.58,
  cost,
  measurementUnit,
  reason,
})

describe(imdService.toUnprocessedCsv, () => {
  it('includes header and original data with Swedish reason', () => {
    const csv = imdService.toUnprocessedCsv([
      makeUnprocessedRow('306-008-01-0206', 'no-active-lease', { cost: 450.5 }),
    ])

    const lines = csv.split('\n')
    expect(lines[0]).toBe(
      'Hyresobjektskod,Fr.o.m,T.o.m,Enhet,Volym,Kostnad,Måttenhet,Orsak'
    )
    const cols = parseRow(lines[1])
    expect(cols[0]).toBe('306-008-01-0206')
    expect(cols[1]).toBe('2026-01-01')
    expect(cols[2]).toBe('2026-01-31')
    expect(cols[3]).toBe('VV')
    expect(cols[4]).toBe('7,58')
    expect(cols[5]).toBe('450,5')
    expect(cols[6]).toBe('m3')
    expect(cols[7]).toBe('Inget aktivt kontrakt i perioden')
  })

  it('uses correct reason for no-rental-object', () => {
    const csv = imdService.toUnprocessedCsv([
      makeUnprocessedRow('UNKNOWN-CODE', 'no-rental-object'),
    ])

    const cols = parseRow(csv.split('\n')[1])
    expect(cols[7]).toBe('Hyresobjekt saknas i Tenfast')
  })

  it('uses correct reason for amount-too-low', () => {
    const csv = imdService.toUnprocessedCsv([
      makeUnprocessedRow('306-008-01-0201', 'amount-too-low', { cost: 8.2 }),
    ])

    const cols = parseRow(csv.split('\n')[1])
    expect(cols[7]).toBe('Belopp under 15 kr')
  })

  it('uses correct reason for unsupported-unit', () => {
    const csv = imdService.toUnprocessedCsv([
      makeUnprocessedRow('306-008-01-0201', 'unsupported-unit', {
        unit: 'ELEC',
      }),
    ])

    const cols = parseRow(csv.split('\n')[1])
    expect(cols[7]).toBe('Enhet stöds ej: ELEC')
  })

  it('outputs multiple rows', () => {
    const csv = imdService.toUnprocessedCsv([
      makeUnprocessedRow('A', 'no-rental-object'),
      makeUnprocessedRow('B', 'no-active-lease'),
      makeUnprocessedRow('C', 'amount-too-low'),
    ])

    const lines = csv.split('\n')
    expect(lines).toHaveLength(4)
  })
})
