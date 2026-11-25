import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { ListingStatus, leasing, property } from '@onecore/types'

import { routes } from '../vacant-apartments'
import { toVacantApartment } from '../services/get-vacant-apartments'
import * as leasingAdapter from '../../../adapters/leasing-adapter'
import * as propertyBaseAdapter from '../../../adapters/property-base-adapter'
import * as factory from '../../../../test/factories'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

const TODAY = new Date('2026-10-09T00:00:00.000Z')
const day = (offset: number) =>
  new Date(TODAY.getTime() + offset * 24 * 60 * 60 * 1000)

const residence = (
  overrides: Partial<property.ResidenceBatchItem> = {}
): property.ResidenceBatchItem => ({
  rentalId: 'apt-1',
  code: '1203',
  name: 'Lägenhet 1203',
  apartmentNumber: '1203',
  address: {
    street: 'Trädgårdsgatan 19',
    street2: null,
    postalCode: '722 12',
    city: 'Västerås',
  },
  property: { code: '123-456', name: 'LINDAREN 2' },
  building: { code: '123-456-01', name: null },
  marketArea: { code: 'VAS', name: 'Vasastan' },
  residenceType: { code: '4RK', name: '4 rum och kök', roomCount: 4 },
  floor: '4',
  elevator: true,
  area: 102,
  ...overrides,
})

const block = (
  overrides: Partial<property.RentalBlock> = {}
): property.RentalBlock => ({
  id: 'block-1',
  rentalId: 'apt-1',
  blockReasonId: 'reason-1',
  blockReason: 'Reparation',
  fromDate: day(-2),
  toDate: day(20),
  amount: null,
  ...overrides,
})

const summary = (
  overrides: Partial<leasing.RentalObjectListingSummary> = {}
): leasing.RentalObjectListingSummary => ({
  rentalObjectCode: 'apt-1',
  currentListing: null,
  closedListingsSinceLastLease: 0,
  ...overrides,
})

const listing = (
  status: ListingStatus
): leasing.RentalObjectListingSummary['currentListing'] => ({
  id: 7,
  rentalObjectCode: 'apt-1',
  status,
  rentalRule: 'SCORED',
  listingCategory: 'APARTMENT',
  publishedFrom: status === ListingStatus.Draft ? null : day(-3),
  publishedTo: null,
  reviewedAt: null,
  reviewedBy: null,
})

const availability = (vacantFrom: Date | undefined = day(10)) =>
  factory.rentalObjectAvailabilityInfo.build({
    rentalObjectCode: 'apt-1',
    vacantFrom,
    rent: factory.rentalObjectRent.build({ amount: 14200 }),
    rentalTenureType: { id: 'STD', name: 'Standard' },
    rentalTags: [{ id: 'kompisbo', name: 'Kompisbo' }],
  })

beforeEach(() => {
  jest.resetAllMocks()
  jest.useFakeTimers({ now: TODAY })
})
afterEach(() => jest.useRealTimers())

describe(toVacantApartment, () => {
  it('keeps an apartment without a listing and copies the sources', () => {
    const row = toVacantApartment({
      availability: availability(),
      residence: residence(),
      blocks: [],
      summary: summary({ closedListingsSinceLastLease: 2 }),
    })

    expect(row).toMatchObject({
      rentalObjectCode: 'apt-1',
      address: { street: 'Trädgårdsgatan 19', city: 'Västerås' },
      marketAreaName: 'Vasastan',
      roomCount: 4,
      area: 102,
      rent: 14200,
      rentalTenureType: { id: 'STD', name: 'Standard' },
      rentalTags: [{ id: 'kompisbo', name: 'Kompisbo' }],
      vacantFrom: day(10),
      block: null,
      listing: null,
      closedListingsSinceLastLease: 2,
    })
  })

  it('keeps an apartment with a draft listing and exposes it', () => {
    const draft = listing(ListingStatus.Draft)
    const row = toVacantApartment({
      availability: availability(),
      residence: residence(),
      blocks: [],
      summary: summary({ currentListing: draft }),
    })

    expect(row?.listing).toEqual(draft)
  })

  it.each([ListingStatus.Active, ListingStatus.Expired])(
    'drops an apartment whose listing has status %s',
    (status) => {
      const row = toVacantApartment({
        availability: availability(),
        residence: residence(),
        blocks: [],
        summary: summary({ currentListing: listing(status) }),
      })

      expect(row).toBeNull()
    }
  )

  it.each(['NATT', 'BLOCK', 'AVS', 'STUD'])(
    'drops an apartment with tenure type %s',
    (id) => {
      const row = toVacantApartment({
        availability: factory.rentalObjectAvailabilityInfo.build({
          rentalObjectCode: 'apt-1',
          rentalTenureType: { id, name: id },
        }),
        residence: residence(),
        blocks: [],
        summary: summary(),
      })

      expect(row).toBeNull()
    }
  )

  it('drops an apartment without a configured rent', () => {
    const row = toVacantApartment({
      availability: factory.rentalObjectAvailabilityInfo.build({
        rentalObjectCode: 'apt-1',
        rent: factory.rentalObjectRent.build({ amount: 0 }),
      }),
      residence: residence(),
      blocks: [],
      summary: summary(),
    })

    expect(row).toBeNull()
  })

  it('drops an apartment that the leases hold until further notice', () => {
    const row = toVacantApartment({
      availability: factory.rentalObjectAvailabilityInfo.build({
        rentalObjectCode: 'apt-1',
        vacantFrom: undefined,
        rent: factory.rentalObjectRent.build({ amount: 14200 }),
      }),
      residence: residence(),
      blocks: [],
      summary: summary(),
    })

    expect(row).toBeNull()
  })

  it.each([
    ['started', day(-2)],
    ['future', day(5)],
  ])('drops an apartment under a %s open-ended block', (_label, fromDate) => {
    const row = toVacantApartment({
      availability: availability(),
      residence: residence(),
      blocks: [block({ fromDate, toDate: null, blockReason: 'Rivning' })],
      summary: summary(),
    })

    expect(row).toBeNull()
  })

  it.each([
    ['started', day(-2)],
    ['future', day(5)],
  ])('lets from the day after a %s dated block', (_label, fromDate) => {
    const row = toVacantApartment({
      availability: availability(day(2)),
      residence: residence(),
      blocks: [block({ fromDate, toDate: day(20), blockReason: 'Reparation' })],
      summary: summary(),
    })

    expect(row?.vacantFrom).toEqual(day(21))
    expect(row?.block).toMatchObject({ reason: 'Reparation' })
  })

  it('keeps the Tenfast date when it is later than the block end', () => {
    const row = toVacantApartment({
      availability: availability(day(30)),
      residence: residence(),
      blocks: [block({ fromDate: day(-2), toDate: day(20) })],
      summary: summary(),
    })

    expect(row?.vacantFrom).toEqual(day(30))
  })

  it('uses the block that ends last when there are several', () => {
    const row = toVacantApartment({
      availability: availability(day(2)),
      residence: residence(),
      blocks: [
        block({ fromDate: day(-2), toDate: day(10), blockReason: 'Kort' }),
        block({ fromDate: day(12), toDate: day(40), blockReason: 'Lång' }),
      ],
      summary: summary(),
    })

    expect(row?.vacantFrom).toEqual(day(41))
    expect(row?.block?.reason).toBe('Lång')
  })
})

describe('GET /vacant-apartments', () => {
  it('composes the three sources and skips codes property does not know', async () => {
    jest
      .spyOn(leasingAdapter, 'getVacantRentalObjectAvailabilities')
      .mockResolvedValueOnce({
        ok: true,
        data: [
          availability(),
          factory.rentalObjectAvailabilityInfo.build({
            rentalObjectCode: 'sold-1',
          }),
        ],
      })
    const residencesSpy = jest
      .spyOn(propertyBaseAdapter, 'getResidencesBatch')
      .mockResolvedValueOnce({ ok: true, data: [residence()] })
    const blocksSpy = jest
      .spyOn(propertyBaseAdapter, 'getRentalBlocksBatch')
      .mockResolvedValueOnce({ ok: true, data: [block()] })
    const summariesSpy = jest
      .spyOn(leasingAdapter, 'getListingSummariesByRentalObjectCodes')
      .mockResolvedValueOnce({
        ok: true,
        data: [summary(), summary({ rentalObjectCode: 'sold-1' })],
      })

    const res = await request(app.callback()).get('/vacant-apartments')

    expect(res.status).toBe(200)
    expect(residencesSpy).toHaveBeenCalledWith(['apt-1', 'sold-1'])
    expect(blocksSpy).toHaveBeenCalledWith(['apt-1', 'sold-1'])
    expect(summariesSpy).toHaveBeenCalledWith({
      rentalObjects: [
        { rentalObjectCode: 'apt-1', listingHistorySince: null },
        { rentalObjectCode: 'sold-1', listingHistorySince: null },
      ],
      listingCategory: 'APARTMENT',
    })
    expect(res.body.content).toHaveLength(1)
    expect(res.body.content[0]).toMatchObject({
      rentalObjectCode: 'apt-1',
      rent: 14200,
      vacantFrom: day(21).toISOString(),
      block: { reason: 'Reparation' },
    })
  })

  it('returns an empty list without calling the other services when nothing is vacant', async () => {
    jest
      .spyOn(leasingAdapter, 'getVacantRentalObjectAvailabilities')
      .mockResolvedValueOnce({ ok: true, data: [] })
    const residencesSpy = jest.spyOn(propertyBaseAdapter, 'getResidencesBatch')

    const res = await request(app.callback()).get('/vacant-apartments')

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual([])
    expect(residencesSpy).not.toHaveBeenCalled()
  })

  it('responds with 500 when a source fails', async () => {
    jest
      .spyOn(leasingAdapter, 'getVacantRentalObjectAvailabilities')
      .mockResolvedValueOnce({ ok: true, data: [availability()] })
    jest
      .spyOn(propertyBaseAdapter, 'getResidencesBatch')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })
    jest
      .spyOn(propertyBaseAdapter, 'getRentalBlocksBatch')
      .mockResolvedValueOnce({ ok: true, data: [] })
    jest
      .spyOn(leasingAdapter, 'getListingSummariesByRentalObjectCodes')
      .mockResolvedValueOnce({ ok: true, data: [summary()] })

    const res = await request(app.callback()).get('/vacant-apartments')

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('get-residences-failed')
  })
})
