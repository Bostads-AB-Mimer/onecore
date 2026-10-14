import * as leasingAdapter from '../../../../adapters/leasing-adapter'
import * as propertyBaseAdapter from '../../../../adapters/property-base-adapter'
import { components } from '../../../../adapters/property-base-adapter/generated/api-types'
import {
  getApartments,
  latestBlock,
} from '../../helpers/apartment-rental-objects'
import * as factory from '../../../../../test/factories'

type Summary = components['schemas']['RentalObjectSummary']
type Details = components['schemas']['RentalObjectDetails']

const TODAY = new Date('2026-10-13T00:00:00.000Z')

const summary = (rentalId: string): Summary => ({
  rentalId,
  type: 'residence',
  code: '0201',
  name: 'POLISGRÄND 3',
  subtypeCode: '3RK',
  subtypeName: '3 rum och kök',
  address: 'Polisgränd 3',
  buildingCode: '101-001',
  staircaseCode: '07',
  staircaseName: 'POLISGRÄND 3',
  parkingAreaCode: null,
  propertyCode: '12001',
  propertyName: 'JOHAN 4',
})

const details = (rentalId: string, overrides: Partial<Details> = {}) => ({
  rentalId,
  baseRent: 13372.07,
  area: 80,
  boaArea: 77,
  floor: '2',
  roomCount: 3,
  marketAreaCode: 'CEN',
  marketAreaName: 'Centrum',
  additionalInfo: null,
  malarEnergiFacilityId: null,
  ...overrides,
})

const block = (
  fromDate: string,
  toDate: string | null,
  blockReasonId: string | null = 'REASON'
) => ({
  id: `${fromDate}-${toDate}`,
  blockReasonId,
  blockReason: null,
  fromDate,
  toDate,
  amount: null,
})

const mockProperty = (summaries: Summary[], detailRows: Details[]) => {
  const search = jest
    .spyOn(propertyBaseAdapter, 'searchRentalObjects')
    .mockImplementation(async ({ rentalIds }) => ({
      ok: true,
      data: {
        content: summaries.filter((s) => rentalIds?.includes(s.rentalId)),
        totalCount: 0,
      },
    }))
  const getDetails = jest
    .spyOn(propertyBaseAdapter, 'getRentalObjectDetails')
    .mockImplementation(async ({ rentalIds }) => ({
      ok: true,
      data: detailRows.filter((d) => rentalIds?.includes(d.rentalId)),
    }))
  return { search, getDetails }
}

beforeEach(() => {
  jest.restoreAllMocks()
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
  jest.setSystemTime(TODAY)
  jest
    .spyOn(propertyBaseAdapter, 'getRentalBlocksByRentalId')
    .mockResolvedValue({ ok: true, data: [] })
  jest
    .spyOn(leasingAdapter, 'getLeaseAvailabilities')
    .mockResolvedValue({ ok: true, data: [] })
})

afterEach(() => jest.useRealTimers())

describe(getApartments, () => {
  it('builds the apartment from property, blocks and lease availability', async () => {
    mockProperty([summary('A1')], [details('A1')])
    jest
      .spyOn(propertyBaseAdapter, 'getRentalBlocksByRentalId')
      .mockResolvedValueOnce({
        ok: true,
        data: [block('2026-10-01T00:00:00.000Z', '2026-11-30T00:00:00.000Z')],
      })
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
        braArea: 80,
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
    mockProperty([summary('A1')], [details('A1')])
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

  it('leaves out codes that are not apartments', async () => {
    mockProperty([summary('A1')], [details('A1')])

    const result = await getApartments(['A1', 'PARKING'])

    expect(result.ok && result.data.map((a) => a.rentalObjectCode)).toEqual([
      'A1',
    ])
    expect(leasingAdapter.getLeaseAvailabilities).toHaveBeenCalledWith(['A1'])
    expect(propertyBaseAdapter.getRentalBlocksByRentalId).toHaveBeenCalledTimes(
      1
    )
  })

  it('keeps an apartment without a details row, without the details fields', async () => {
    mockProperty([summary('A1')], [])

    const result = await getApartments(['A1'])

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toHaveLength(1)
    expect(result.data[0]).toMatchObject({
      rentalObjectCode: 'A1',
      address: 'Polisgränd 3',
      residentialAreaCode: '',
      residentialAreaCaption: '',
    })
    expect(result.data[0].boaArea).toBeUndefined()
    expect(result.data[0].floor).toBeUndefined()
    expect(result.data[0].roomCount).toBeUndefined()
  })

  it('queries property in batches of 200 with a limit that fits each batch', async () => {
    const codes = Array.from({ length: 250 }, (_, i) => `A${i}`)
    const { search, getDetails } = mockProperty([], [])

    await getApartments([...codes, 'A0'])

    expect(search).toHaveBeenCalledTimes(2)
    expect(search).toHaveBeenCalledWith({
      rentalIds: codes.slice(0, 200),
      types: ['residence'],
      limit: 200,
    })
    expect(search).toHaveBeenCalledWith({
      rentalIds: codes.slice(200),
      types: ['residence'],
      limit: 50,
    })
    expect(getDetails).toHaveBeenCalledTimes(2)
  })

  it('makes no requests for no codes, nor for blocks and leases when nothing matched', async () => {
    const { search } = mockProperty([], [])

    expect(await getApartments([])).toEqual({ ok: true, data: [] })
    expect(search).not.toHaveBeenCalled()

    expect(await getApartments(['PARKING'])).toEqual({ ok: true, data: [] })
    expect(leasingAdapter.getLeaseAvailabilities).not.toHaveBeenCalled()
    expect(propertyBaseAdapter.getRentalBlocksByRentalId).not.toHaveBeenCalled()
  })

  it('fails when property fails', async () => {
    mockProperty([summary('A1')], [details('A1')])
    jest
      .spyOn(propertyBaseAdapter, 'getRentalObjectDetails')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    expect(await getApartments(['A1'])).toEqual({ ok: false, err: 'unknown' })
  })

  it('fails when blocks cannot be read, but not when an apartment has none', async () => {
    mockProperty([summary('A1')], [details('A1')])
    jest
      .spyOn(propertyBaseAdapter, 'getRentalBlocksByRentalId')
      .mockResolvedValueOnce({ ok: false, err: 'not-found' })
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    expect((await getApartments(['A1'])).ok).toBe(true)
    expect(await getApartments(['A1'])).toEqual({ ok: false, err: 'unknown' })
  })

  it('returns apartments without availability when the lease lookup fails', async () => {
    mockProperty([summary('A1')], [details('A1')])
    jest
      .spyOn(leasingAdapter, 'getLeaseAvailabilities')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const result = await getApartments(['A1'])

    expect(result.ok && result.data[0].availabilityInfo).toBeUndefined()
  })
})

describe(latestBlock, () => {
  it('prefers a block without an end date', () => {
    const open = block('2026-01-01', null)
    expect(
      latestBlock([
        block('2026-02-01', '2027-01-01'),
        open,
        block('2025-01-01', '2025-02-01'),
      ])
    ).toBe(open)
  })

  it('otherwise picks the block that ends last', () => {
    const last = block('2026-02-01', '2027-01-01')
    expect(
      latestBlock([
        block('2025-01-01', '2025-02-01'),
        last,
        block('2026-05-01', '2026-06-01'),
      ])
    ).toBe(last)
  })

  it('ignores blocks without a reason, as leasing does', () => {
    const withReason = block('2025-01-01', '2025-02-01')
    expect(latestBlock([block('2026-01-01', null, null), withReason])).toBe(
      withReason
    )
    expect(latestBlock([block('2026-01-01', null, null)])).toBeUndefined()
  })

  it('is undefined without blocks', () => {
    expect(latestBlock([])).toBeUndefined()
  })
})
