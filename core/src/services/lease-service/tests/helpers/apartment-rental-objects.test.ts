import { property } from '@onecore/types'

import * as leasingAdapter from '../../../../adapters/leasing-adapter'
import * as propertyBaseAdapter from '../../../../adapters/property-base-adapter'
import { getApartments } from '../../helpers/apartment-rental-objects'
import { governingBlock } from '../../helpers/rental-blocks'
import * as factory from '../../../../../test/factories'

const TODAY = new Date('2026-10-19T00:00:00.000Z')

const residence = (
  rentalId: string,
  overrides: Partial<property.ResidenceBatchItem> = {}
): property.ResidenceBatchItem => ({
  rentalId,
  code: '0201',
  name: 'POLISGRÄND 3',
  apartmentNumber: '1201',
  address: {
    street: 'Polisgränd 3',
    street2: null,
    postalCode: '72211',
    city: 'Västerås',
  },
  property: { code: '12001', name: 'JOHAN 4' },
  building: { code: '101-001', name: null },
  marketArea: { code: 'CEN', name: 'Centrum' },
  residenceType: { code: '3RK', name: '3 rum och kök', roomCount: 3 },
  floor: '2',
  elevator: true,
  area: 77,
  ...overrides,
})

const block = (
  rentalId: string,
  fromDate: string,
  toDate: string | null,
  blockReasonId: string | null = 'REASON'
): property.RentalBlock => ({
  id: `${rentalId}-${fromDate}`,
  rentalId,
  blockReasonId,
  blockReason: blockReasonId ? 'Renovering' : null,
  fromDate: new Date(fromDate),
  toDate: toDate ? new Date(toDate) : null,
  amount: null,
})

const mockProperty = (
  residences: property.ResidenceBatchItem[],
  blocks: property.RentalBlock[] = []
) => {
  const getResidences = jest
    .spyOn(propertyBaseAdapter, 'getResidencesBatch')
    .mockImplementation(async (rentalIds) => ({
      ok: true,
      data: residences.filter((r) => rentalIds.includes(r.rentalId)),
    }))
  const getBlocks = jest
    .spyOn(propertyBaseAdapter, 'getRentalBlocksBatch')
    .mockImplementation(async (rentalIds) => ({
      ok: true,
      data: blocks.filter((b) => rentalIds.includes(b.rentalId)),
    }))
  return { getResidences, getBlocks }
}

beforeEach(() => {
  jest.restoreAllMocks()
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
  jest.setSystemTime(TODAY)
  jest
    .spyOn(leasingAdapter, 'getLeaseAvailabilities')
    .mockResolvedValue({ ok: true, data: [] })
})

afterEach(() => jest.useRealTimers())

describe(getApartments, () => {
  it('builds the apartment from the residence, its blocks and the leases', async () => {
    mockProperty(
      [residence('A1')],
      [block('A1', '2026-10-01T00:00:00.000Z', '2026-11-30T00:00:00.000Z')]
    )
    const availability = factory.rentalObjectAvailabilityInfo.build({
      rentalObjectCode: 'A1',
      vacantFrom: new Date('2026-11-01T00:00:00.000Z'),
    })
    jest
      .spyOn(leasingAdapter, 'getLeaseAvailabilities')
      .mockResolvedValueOnce({ ok: true, data: [availability] })

    const result = await getApartments(['A1'])

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toEqual([
      expect.objectContaining({
        rentalObjectCode: 'A1',
        address: 'Polisgränd 3',
        propertyCode: '12001',
        propertyCaption: 'JOHAN 4',
        residentialAreaCode: 'CEN',
        residentialAreaCaption: 'Centrum',
        objectTypeCode: '3RK',
        objectTypeCaption: '3 rum och kök',
        boaArea: 77,
        floor: '2',
        roomCount: 3,
        blockStartDate: new Date('2026-10-01T00:00:00.000Z'),
        blockEndDate: new Date('2026-11-30T00:00:00.000Z'),
      }),
    ])
    // The block ends after the lease, so the apartment is vacant the day after it.
    expect(result.data[0].availabilityInfo).toEqual({
      ...availability,
      vacantFrom: new Date('2026-12-01T00:00:00.000Z'),
    })
  })

  it('uses the lease date when there is no block', async () => {
    mockProperty([residence('A1')])
    const vacantFrom = new Date('2026-11-01T00:00:00.000Z')
    jest.spyOn(leasingAdapter, 'getLeaseAvailabilities').mockResolvedValueOnce({
      ok: true,
      data: [
        factory.rentalObjectAvailabilityInfo.build({
          rentalObjectCode: 'A1',
          vacantFrom,
        }),
      ],
    })

    const result = await getApartments(['A1'])

    expect(result.ok && result.data[0].availabilityInfo?.vacantFrom).toEqual(
      vacantFrom
    )
    expect(result.ok && result.data[0].blockStartDate).toBeUndefined()
  })

  it('counts a block without a reason', async () => {
    mockProperty(
      [residence('A1')],
      [block('A1', '2026-10-01T00:00:00.000Z', null, null)]
    )
    jest.spyOn(leasingAdapter, 'getLeaseAvailabilities').mockResolvedValueOnce({
      ok: true,
      data: [
        factory.rentalObjectAvailabilityInfo.build({ rentalObjectCode: 'A1' }),
      ],
    })

    const result = await getApartments(['A1'])

    // An open-ended block: not vacant, whatever the leases say.
    expect(
      result.ok && result.data[0].availabilityInfo?.vacantFrom
    ).toBeUndefined()
  })

  it('leaves out codes that are not apartments', async () => {
    mockProperty([residence('A1')])

    const result = await getApartments(['A1', 'PARKING'])

    expect(result.ok && result.data.map((a) => a.rentalObjectCode)).toEqual([
      'A1',
    ])
  })

  it('asks property and the leases once per batch, for each code once', async () => {
    const codes = Array.from({ length: 5001 }, (_, i) => `A${i}`)
    const { getResidences, getBlocks } = mockProperty([])

    await getApartments([...codes, 'A0'])

    expect(getResidences).toHaveBeenCalledTimes(2)
    expect(getResidences).toHaveBeenCalledWith(codes.slice(0, 5000))
    expect(getResidences).toHaveBeenCalledWith(codes.slice(5000))
    expect(getBlocks).toHaveBeenCalledTimes(2)
    expect(leasingAdapter.getLeaseAvailabilities).toHaveBeenCalledWith(codes)
  })

  it('makes no requests for no codes', async () => {
    const { getResidences } = mockProperty([])

    expect(await getApartments([])).toEqual({ ok: true, data: [] })
    expect(getResidences).not.toHaveBeenCalled()
    expect(leasingAdapter.getLeaseAvailabilities).not.toHaveBeenCalled()
  })

  it('fails when the residences or the blocks cannot be read', async () => {
    mockProperty([residence('A1')])
    jest
      .spyOn(propertyBaseAdapter, 'getResidencesBatch')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })
    expect(await getApartments(['A1'])).toEqual({ ok: false, err: 'unknown' })

    jest
      .spyOn(propertyBaseAdapter, 'getRentalBlocksBatch')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })
    expect(await getApartments(['A1'])).toEqual({ ok: false, err: 'unknown' })
  })

  it('returns apartments without availability when the lease lookup fails', async () => {
    mockProperty([residence('A1')])
    jest
      .spyOn(leasingAdapter, 'getLeaseAvailabilities')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const result = await getApartments(['A1'])

    expect(result.ok && result.data[0].availabilityInfo).toBeUndefined()
  })

  it('copes with a residence missing its optional parts', async () => {
    mockProperty([
      residence('A1', {
        address: null,
        property: null,
        marketArea: null,
        residenceType: null,
        floor: null,
        area: null,
      }),
    ])

    const result = await getApartments(['A1'])

    expect(result.ok && result.data[0]).toMatchObject({
      rentalObjectCode: 'A1',
      address: '',
      residentialAreaCode: '',
      objectTypeCode: '',
    })
  })
})

describe(governingBlock, () => {
  it('prefers a block without an end date', () => {
    const open = block('A1', '2026-01-01T00:00:00.000Z', null)
    const later = block(
      'A1',
      '2026-02-01T00:00:00.000Z',
      '2027-01-01T00:00:00.000Z'
    )

    expect(governingBlock([later, open])).toBe(open)
  })

  it('otherwise picks the block that ends last', () => {
    const early = block(
      'A1',
      '2026-01-01T00:00:00.000Z',
      '2026-11-01T00:00:00.000Z'
    )
    const late = block(
      'A1',
      '2026-02-01T00:00:00.000Z',
      '2026-12-01T00:00:00.000Z'
    )

    expect(governingBlock([early, late])).toBe(late)
  })

  it('counts a block without a reason', () => {
    const noReason = block('A1', '2026-01-01T00:00:00.000Z', null, null)

    expect(governingBlock([noReason])).toBe(noReason)
  })

  it('is undefined without blocks', () => {
    expect(governingBlock([])).toBeUndefined()
  })
})
