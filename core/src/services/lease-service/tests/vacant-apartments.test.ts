import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { ListingStatus, leasing, property } from '@onecore/types'

import { routes } from '../vacant-apartments'
import {
  pickGoverningBlock,
  toVacantApartment,
} from '../services/get-vacant-apartments'
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

const details = (
  overrides: Partial<property.ResidenceLeasingDetails> = {}
): property.ResidenceLeasingDetails => ({
  rentalId: 'apt-1',
  address: 'Trädgårdsgatan 19',
  apartmentNumber: '1203',
  propertyCode: '123-456',
  propertyName: 'LINDAREN 2',
  buildingCode: '123-456-01',
  marketAreaCode: 'VAS',
  marketAreaName: 'Vasastan',
  residenceTypeCode: '4RK',
  residenceTypeName: '4 rum och kök',
  roomCount: 4,
  floor: '4',
  elevator: true,
  area: 102,
  rentalBlocks: [],
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
    rentalTenureType: { id: 'STUD', name: 'Studentbostad' },
    rentalTags: [{ id: 'kompisbo', name: 'Kompisbo' }],
  })

beforeEach(() => {
  jest.resetAllMocks()
  jest.useFakeTimers({ now: TODAY })
})
afterEach(() => jest.useRealTimers())

describe(pickGoverningBlock, () => {
  it('returns null without blocks', () => {
    expect(pickGoverningBlock([])).toBeNull()
  })

  it('prefers an open-ended block over any dated one', () => {
    const open = { fromDate: day(1), toDate: null, reason: 'Renovering' }
    const dated = { fromDate: day(-5), toDate: day(30), reason: null }
    expect(pickGoverningBlock([dated, open])).toBe(open)
  })

  it('otherwise takes the block that ends last', () => {
    const early = { fromDate: day(-5), toDate: day(3), reason: null }
    const late = { fromDate: day(-1), toDate: day(20), reason: null }
    expect(pickGoverningBlock([late, early])).toBe(late)
  })
})

describe(toVacantApartment, () => {
  it('keeps an apartment without a listing and copies the sources', () => {
    const row = toVacantApartment({
      availability: availability(),
      details: details(),
      summary: summary({ closedListingsSinceLastLease: 2 }),
    })

    expect(row).toMatchObject({
      rentalObjectCode: 'apt-1',
      address: 'Trädgårdsgatan 19',
      marketAreaName: 'Vasastan',
      roomCount: 4,
      area: 102,
      rent: 14200,
      rentalTenureType: { id: 'STUD', name: 'Studentbostad' },
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
      details: details(),
      summary: summary({ currentListing: draft }),
    })

    expect(row?.listing).toEqual(draft)
  })

  it.each([ListingStatus.Active, ListingStatus.Expired])(
    'drops an apartment whose listing has status %s',
    (status) => {
      const row = toVacantApartment({
        availability: availability(),
        details: details(),
        summary: summary({ currentListing: listing(status) }),
      })

      expect(row).toBeNull()
    }
  )

  it.each(['NATT', 'BLOCK', 'AVS'])(
    'drops an apartment with tenure type %s',
    (id) => {
      const row = toVacantApartment({
        availability: factory.rentalObjectAvailabilityInfo.build({
          rentalObjectCode: 'apt-1',
          rentalTenureType: { id, name: id },
        }),
        details: details(),
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
      details: details(),
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
      details: details({
        rentalBlocks: [{ fromDate, toDate: null, reason: 'Rivning' }],
      }),
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
      details: details({
        rentalBlocks: [{ fromDate, toDate: day(20), reason: 'Reparation' }],
      }),
      summary: summary(),
    })

    expect(row?.vacantFrom).toEqual(day(21))
    expect(row?.block).toMatchObject({ reason: 'Reparation' })
  })

  it('keeps the Tenfast date when it is later than the block end', () => {
    const row = toVacantApartment({
      availability: availability(day(30)),
      details: details({
        rentalBlocks: [{ fromDate: day(-2), toDate: day(20), reason: null }],
      }),
      summary: summary(),
    })

    expect(row?.vacantFrom).toEqual(day(30))
  })

  it('uses the block that ends last when there are several', () => {
    const row = toVacantApartment({
      availability: availability(day(2)),
      details: details({
        rentalBlocks: [
          { fromDate: day(-2), toDate: day(10), reason: 'Kort' },
          { fromDate: day(12), toDate: day(40), reason: 'Lång' },
        ],
      }),
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
    const detailsSpy = jest
      .spyOn(propertyBaseAdapter, 'getResidenceLeasingDetails')
      .mockResolvedValueOnce({ ok: true, data: [details()] })
    const summariesSpy = jest
      .spyOn(leasingAdapter, 'getListingSummariesByRentalObjectCodes')
      .mockResolvedValueOnce({
        ok: true,
        data: [summary(), summary({ rentalObjectCode: 'sold-1' })],
      })

    const res = await request(app.callback()).get('/vacant-apartments')

    expect(res.status).toBe(200)
    expect(detailsSpy).toHaveBeenCalledWith(['apt-1', 'sold-1'])
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
    })
  })

  it('returns an empty list without calling the other services when nothing is vacant', async () => {
    jest
      .spyOn(leasingAdapter, 'getVacantRentalObjectAvailabilities')
      .mockResolvedValueOnce({ ok: true, data: [] })
    const detailsSpy = jest.spyOn(
      propertyBaseAdapter,
      'getResidenceLeasingDetails'
    )

    const res = await request(app.callback()).get('/vacant-apartments')

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual([])
    expect(detailsSpy).not.toHaveBeenCalled()
  })

  it('responds with 500 when a source fails', async () => {
    jest
      .spyOn(leasingAdapter, 'getVacantRentalObjectAvailabilities')
      .mockResolvedValueOnce({ ok: true, data: [availability()] })
    jest
      .spyOn(propertyBaseAdapter, 'getResidenceLeasingDetails')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })
    jest
      .spyOn(leasingAdapter, 'getListingSummariesByRentalObjectCodes')
      .mockResolvedValueOnce({ ok: true, data: [summary()] })

    const res = await request(app.callback()).get('/vacant-apartments')

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('get-residence-details-failed')
  })
})
