import assert from 'node:assert'

jest.mock('@src/services/common/adapters/xpand-db-adapter', () => ({
  getActiveLeasesByRentalObjectCodes: jest.fn(),
}))

jest.mock('@src/common/adapters/tenfast/tenfast-adapter', () => ({
  updateLeaseInvoiceRows: jest.fn(),
}))

import { getActiveLeasesByRentalObjectCodes } from '@src/services/common/adapters/xpand-db-adapter'
import { updateLeaseInvoiceRows } from '@src/common/adapters/tenfast/tenfast-adapter'
import { imdService } from '.'

const mockGetActiveLeases =
  getActiveLeasesByRentalObjectCodes as jest.MockedFunction<
    typeof getActiveLeasesByRentalObjectCodes
  >

const mockUpdateLeaseInvoiceRows =
  updateLeaseInvoiceRows as jest.MockedFunction<typeof updateLeaseInvoiceRows>

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
      },
      {
        rentalObjectCode: '306-008-01-0202',
        from: new Date('2026-01-01'),
        to: new Date('2026-01-31'),
        unit: 'VV',
        volume: 2.094,
        cost: 171.74,
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
      },
      {
        rentalObjectCode: '306-008-01-0299',
        from: new Date('2026-01-01'),
        to: new Date('2026-01-31'),
        unit: 'VV',
        volume: 3.0,
        cost: 250.0,
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
      },
    ])

    expect(result.ok).toBe(false)
  })
})

const makeEnrichedRow = (
  rentalObjectCode: string,
  leaseId: string,
  cost = 100
) => ({
  rentalObjectCode,
  leaseId,
  from: new Date('2026-01-01'),
  to: new Date('2026-01-31'),
  unit: 'VV',
  volume: 7.58,
  cost,
})

describe(imdService.addRentRows, () => {
  beforeEach(() => {
    mockUpdateLeaseInvoiceRows.mockReset()
  })

  it('calls updateLeaseInvoiceRows for each row with correct params', async () => {
    mockUpdateLeaseInvoiceRows.mockResolvedValue({ ok: true, data: null })

    await imdService.addRentRows(
      [makeEnrichedRow('306-008-01-0201', '306-008-01-0201/02', 621.68)],
      'article-123',
      'IMD Varmvatten'
    )

    expect(mockUpdateLeaseInvoiceRows).toHaveBeenCalledWith({
      leaseId: '306-008-01-0201/02',
      rowsToDelete: [],
      rowsToAdd: [
        {
          amount: 621.68,
          vat: 0,
          from: '2026-01-01',
          to: '2026-01-31',
          article: 'article-123',
          label: 'IMD Varmvatten',
        },
      ],
    })
  })

  it('reports succeeded and failed rows separately', async () => {
    mockUpdateLeaseInvoiceRows
      .mockResolvedValueOnce({ ok: true, data: null })
      .mockResolvedValueOnce({ ok: false, err: 'lease not found' })

    const result = await imdService.addRentRows(
      [
        makeEnrichedRow('306-008-01-0201', '306-008-01-0201/02'),
        makeEnrichedRow('306-008-01-0202', '306-008-01-0202/01'),
      ],
      'article-123',
      'IMD Varmvatten'
    )

    expect(result.succeeded).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          leaseId: '306-008-01-0201/02',
          rentalObjectCode: '306-008-01-0201',
        }),
      ])
    )
    expect(result.failed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          leaseId: '306-008-01-0202/01',
          rentalObjectCode: '306-008-01-0202',
          error: 'lease not found',
        }),
      ])
    )
  })

  it('handles rejected promises without crashing the batch', async () => {
    mockUpdateLeaseInvoiceRows
      .mockResolvedValueOnce({ ok: true, data: null })
      .mockRejectedValueOnce(new Error('network timeout'))

    const result = await imdService.addRentRows(
      [
        makeEnrichedRow('306-008-01-0201', '306-008-01-0201/02'),
        makeEnrichedRow('306-008-01-0202', '306-008-01-0202/01'),
      ],
      'article-123',
      'IMD Varmvatten'
    )

    expect(result.succeeded).toHaveLength(1)
    expect(result.failed).toHaveLength(1)
    expect(result.failed[0].error).toContain('network timeout')
  })
})
