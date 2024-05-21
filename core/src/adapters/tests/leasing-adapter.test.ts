import { HttpStatusCode } from 'axios'
import nock from 'nock'

import config from '../../common/config'
import * as leasingAdapter from '../leasing-adapter'
import {
  mockedInvoices,
  mockedListingWithDetailedApplicants,
  mockedOldProblematicInvoices,
  mockedProblematicInvoices,
  mockedWaitingList,
} from './leasing-adapter.mocks'

describe('leasing-adapter', () => {
  describe(leasingAdapter.getInternalCreditInformation, () => {
    it('returns true if no problematic invoices', async () => {
      nock(config.tenantsLeasesService.url)
        .get(/contact\/invoices\/contactCode/)
        .reply(200, { data: mockedInvoices })

      const result =
        await leasingAdapter.getInternalCreditInformation('P123456')

      expect(result).toBe(true)
    })

    it('returns false if current problematic invoices', async () => {
      nock(config.tenantsLeasesService.url)
        .get(/contact\/invoices\/contactCode/)
        .reply(200, { data: mockedProblematicInvoices })

      const result =
        await leasingAdapter.getInternalCreditInformation('P123456')

      expect(result).toBe(false)
    })

    it('returns true if old problematic invoices', async () => {
      nock(config.tenantsLeasesService.url)
        .get(/contact\/invoices\/contactCode/)
        .reply(200, { data: mockedOldProblematicInvoices })

      const result =
        await leasingAdapter.getInternalCreditInformation('P123456')

      expect(result).toBe(true)
    })
  })

  describe(leasingAdapter.getWaitingList, () => {
    it('should return waiting list', async () => {
      nock(config.tenantsLeasesService.url)
        .get(/contact\/waitingList\//)
        .reply(200, { data: mockedWaitingList })

      const result = await leasingAdapter.getWaitingList('P123456')

      expect(result).toEqual(
        mockedWaitingList.map((v) => ({
          ...v,
          contractFromApartment: v.contractFromApartment.toISOString(),
          waitingListFrom: v.waitingListFrom.toISOString(),
        }))
      )
    })
  })

  describe(leasingAdapter.getListingByIdWithDetailedApplicants, () => {
    it('should return a listing with detailed applicants', async () => {
      nock(config.tenantsLeasesService.url)
        .get(/listing/)
        .reply(200, mockedListingWithDetailedApplicants)

      const result =
        await leasingAdapter.getListingByIdWithDetailedApplicants('1337')

      expect(result).toEqual(mockedListingWithDetailedApplicants)
    })
  })

  describe(leasingAdapter.addApplicantToWaitingList, () => {
    it('should add applicant to waiting list', async () => {
      nock(config.tenantsLeasesService.url)
        .post(/contact\/waitingList/)
        .reply(201)

      const result = await leasingAdapter.addApplicantToWaitingList(
        '´196709226789',
        'P123456',
        'Bilplats (intern)'
      )

      expect(result.status).toEqual(HttpStatusCode.Created)
    })
  })

  describe(leasingAdapter.createOffer, () => {
    it('should try to create an offer', async () => {
      nock(config.tenantsLeasesService.url)
        .post('/offer')
        .reply(201, { data: { id: 1 } })

      const result = await leasingAdapter.createOffer({
        expiresAt: new Date(),
        listingId: 1,
        applicantId: 1,
        selectedApplicants: [],
        status: 1,
      })

      expect(result).toEqual({ id: 1 })
    })
  })
})
