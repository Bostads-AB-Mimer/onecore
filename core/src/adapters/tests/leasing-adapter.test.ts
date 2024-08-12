import axios, { HttpStatusCode } from 'axios'
jest.mock('onecore-utilities', () => {
  return {
    logger: {
      info: () => {
        return
      },
      error: () => {
        return
      },
    },
    loggedAxios: axios,
    axiosTypes: axios,
  }
})

import nock from 'nock'
import config from '../../common/config'
import * as leasingAdapter from '../leasing-adapter'
import {
  mockedInvoices,
  mockedDetailedApplicants,
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
        .reply(200, mockedDetailedApplicants)

      const result =
        await leasingAdapter.getListingByIdWithDetailedApplicants('1337')

      expect(result).toEqual(mockedDetailedApplicants)
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

  describe(leasingAdapter.getOffersForContact, () => {
    it('should try to get offers', async () => {
      const mockedOffer = [
        {
          id: 3,
          sentAt: null,
          expiresAt: '2024-05-15T13:19:27.000Z',
          answeredAt: null,
          selectedApplicants: [
            {
              address: {
                city: 'JOHANNESHOV',
                number: '',
                postalCode: '12139',
                street: 'Testvägen 25',
              },
              applicationDate: '2024-04-30T09:27:16.3440000',
              applicationType: 'baz',
              contactCode: 'P174965',
              currentHousingContract: {
                approvalDate: '2024-02-01T00:00:00.000Z',
                contractDate: '2024-02-01T00:00:00.000Z',
                lastDebitDate: null,
                leaseEndDate: null,
                leaseId: '705-022-04-0201/11',
                leaseNumber: '11',
                leaseStartDate: '2024-03-01T00:00:00.000Z',
                noticeDate: null,
                noticeGivenBy: null,
                noticeTimeTenant: 3,
                preferredMoveOutDate: null,
                rentalPropertyId: '705-022-04-0201',
                residentialArea: {
                  caption: 'Malmaberg',
                  code: 'MAL',
                },
                tenantContactIds: [],
                tenants: [],
                terminationDate: null,
                type: 'Bostadskontrakt               ',
              },
              id: 1010,
              listingId: 3,
              name: 'Foo Bar',
              nationalRegistrationNumber: '19981123-0102',
              parkingSpaceContracts: [
                {
                  approvalDate: '2024-02-01T00:00:00.000Z',
                  contractDate: '2024-02-01T00:00:00.000Z',
                  lastDebitDate: null,
                  leaseEndDate: null,
                  leaseId: '508-713-00-0009/19',
                  leaseNumber: '19',
                  leaseStartDate: '2024-03-01T00:00:00.000Z',
                  noticeDate: null,
                  noticeGivenBy: null,
                  noticeTimeTenant: 3,
                  preferredMoveOutDate: null,
                  rentalPropertyId: '508-713-00-0009',
                  residentialArea: {
                    caption: 'Skallberget',
                    code: 'SKA',
                  },
                  tenantContactIds: [],
                  tenants: [],
                  terminationDate: null,
                  type: 'P-Platskontrakt               ',
                },
                {
                  approvalDate: null,
                  contractDate: '2024-04-02T00:00:00.000Z',
                  lastDebitDate: null,
                  leaseEndDate: null,
                  leaseId: '216-704-00-0017/02',
                  leaseNumber: '02',
                  leaseStartDate: '2024-04-02T00:00:00.000Z',
                  noticeDate: null,
                  noticeGivenBy: null,
                  noticeTimeTenant: 3,
                  preferredMoveOutDate: null,
                  rentalPropertyId: '216-704-00-0017',
                  residentialArea: {
                    caption: 'Skälby',
                    code: 'SKÄ',
                  },
                  tenantContactIds: [],
                  tenants: [],
                  terminationDate: null,
                  type: 'P-Platskontrakt               ',
                },
                {
                  approvalDate: null,
                  contractDate: '2024-04-02T00:00:00.000Z',
                  lastDebitDate: null,
                  leaseEndDate: null,
                  leaseId: '216-704-00-0027/03',
                  leaseNumber: '03',
                  leaseStartDate: '2024-04-02T00:00:00.000Z',
                  noticeDate: null,
                  noticeGivenBy: null,
                  noticeTimeTenant: 3,
                  preferredMoveOutDate: null,
                  rentalPropertyId: '216-704-00-0027',
                  residentialArea: {
                    caption: 'Skälby',
                    code: 'SKÄ',
                  },
                  tenantContactIds: [],
                  tenants: [],
                  terminationDate: null,
                  type: 'P-Platskontrakt               ',
                },
                {
                  approvalDate: null,
                  contractDate: '2024-04-02T00:00:00.000Z',
                  lastDebitDate: null,
                  leaseEndDate: null,
                  leaseId: '216-704-00-0009/03',
                  leaseNumber: '03',
                  leaseStartDate: '2024-04-02T00:00:00.000Z',
                  noticeDate: null,
                  noticeGivenBy: null,
                  noticeTimeTenant: 3,
                  preferredMoveOutDate: null,
                  rentalPropertyId: '216-704-00-0009',
                  residentialArea: {
                    caption: 'Skälby',
                    code: 'SKÄ',
                  },
                  tenantContactIds: [],
                  tenants: [],
                  terminationDate: null,
                  type: 'P-Platskontrakt               ',
                },
                {
                  approvalDate: null,
                  contractDate: '2024-04-02T00:00:00.000Z',
                  lastDebitDate: null,
                  leaseEndDate: null,
                  leaseId: '216-703-00-0004/03',
                  leaseNumber: '03',
                  leaseStartDate: '2024-04-02T00:00:00.000Z',
                  noticeDate: null,
                  noticeGivenBy: null,
                  noticeTimeTenant: 3,
                  preferredMoveOutDate: null,
                  rentalPropertyId: '216-703-00-0004',
                  residentialArea: {
                    caption: 'Skälby',
                    code: 'SKÄ',
                  },
                  tenantContactIds: [],
                  tenants: [],
                  terminationDate: null,
                  type: 'P-Platskontrakt               ',
                },
                {
                  approvalDate: null,
                  contractDate: '2024-04-02T00:00:00.000Z',
                  lastDebitDate: null,
                  leaseEndDate: null,
                  leaseId: '216-703-00-0009/02',
                  leaseNumber: '02',
                  leaseStartDate: '2024-04-02T00:00:00.000Z',
                  noticeDate: null,
                  noticeGivenBy: null,
                  noticeTimeTenant: 3,
                  preferredMoveOutDate: null,
                  rentalPropertyId: '216-703-00-0009',
                  residentialArea: {
                    caption: 'Skälby',
                    code: 'SKÄ',
                  },
                  tenantContactIds: [],
                  tenants: [],
                  terminationDate: null,
                  type: 'P-Platskontrakt               ',
                },
                {
                  approvalDate: null,
                  contractDate: '2024-04-02T00:00:00.000Z',
                  lastDebitDate: null,
                  leaseEndDate: null,
                  leaseId: '216-703-00-0016/03',
                  leaseNumber: '03',
                  leaseStartDate: '2024-04-02T00:00:00.000Z',
                  noticeDate: null,
                  noticeGivenBy: null,
                  noticeTimeTenant: 3,
                  preferredMoveOutDate: null,
                  rentalPropertyId: '216-703-00-0016',
                  residentialArea: {
                    caption: 'Skälby',
                    code: 'SKÄ',
                  },
                  tenantContactIds: [],
                  tenants: [],
                  terminationDate: null,
                  type: 'P-Platskontrakt               ',
                },
                {
                  approvalDate: null,
                  contractDate: '2024-04-02T00:00:00.000Z',
                  lastDebitDate: null,
                  leaseEndDate: null,
                  leaseId: '216-704-00-0022/02',
                  leaseNumber: '02',
                  leaseStartDate: '2024-04-02T00:00:00.000Z',
                  noticeDate: null,
                  noticeGivenBy: null,
                  noticeTimeTenant: 3,
                  preferredMoveOutDate: null,
                  rentalPropertyId: '216-704-00-0022',
                  residentialArea: {
                    caption: 'Skälby',
                    code: 'SKÄ',
                  },
                  tenantContactIds: [],
                  tenants: [],
                  terminationDate: null,
                  type: 'P-Platskontrakt               ',
                },
                {
                  approvalDate: null,
                  contractDate: '2024-04-03T00:00:00.000Z',
                  lastDebitDate: null,
                  leaseEndDate: null,
                  leaseId: '705-708-00-0004/13',
                  leaseNumber: '13',
                  leaseStartDate: '2024-04-03T00:00:00.000Z',
                  noticeDate: null,
                  noticeGivenBy: null,
                  noticeTimeTenant: 3,
                  preferredMoveOutDate: null,
                  rentalPropertyId: '705-708-00-0004',
                  residentialArea: {
                    caption: 'Malmaberg',
                    code: 'MAL',
                  },
                  tenantContactIds: [],
                  tenants: [],
                  terminationDate: null,
                  type: 'P-Platskontrakt               ',
                },
                {
                  approvalDate: null,
                  contractDate: '2024-04-04T00:00:00.000Z',
                  lastDebitDate: null,
                  leaseEndDate: null,
                  leaseId: '216-703-00-0007/03',
                  leaseNumber: '03',
                  leaseStartDate: '2024-04-04T00:00:00.000Z',
                  noticeDate: null,
                  noticeGivenBy: null,
                  noticeTimeTenant: 3,
                  preferredMoveOutDate: null,
                  rentalPropertyId: '216-703-00-0007',
                  residentialArea: {
                    caption: 'Skälby',
                    code: 'SKÄ',
                  },
                  tenantContactIds: [],
                  tenants: [],
                  terminationDate: null,
                  type: 'P-Platskontrakt               ',
                },
                {
                  approvalDate: null,
                  contractDate: '2024-05-27T00:00:00.000Z',
                  lastDebitDate: null,
                  leaseEndDate: null,
                  leaseId: '211-726-00-0009/04',
                  leaseNumber: '04',
                  leaseStartDate: '2024-05-27T00:00:00.000Z',
                  noticeDate: null,
                  noticeGivenBy: null,
                  noticeTimeTenant: 3,
                  preferredMoveOutDate: null,
                  rentalPropertyId: '211-726-00-0009',
                  residentialArea: {
                    caption: 'Bäckby',
                    code: 'BÄC',
                  },
                  tenantContactIds: [],
                  tenants: [],
                  terminationDate: null,
                  type: 'P-Platskontrakt               ',
                },
                {
                  approvalDate: null,
                  contractDate: '2024-05-27T00:00:00.000Z',
                  lastDebitDate: null,
                  leaseEndDate: null,
                  leaseId: '211-725-00-0014/07',
                  leaseNumber: '07',
                  leaseStartDate: '2024-05-27T00:00:00.000Z',
                  noticeDate: null,
                  noticeGivenBy: null,
                  noticeTimeTenant: 3,
                  preferredMoveOutDate: null,
                  rentalPropertyId: '211-725-00-0014',
                  residentialArea: {
                    caption: 'Bäckby',
                    code: 'BÄC',
                  },
                  tenantContactIds: [],
                  tenants: [],
                  terminationDate: null,
                  type: 'P-Platskontrakt               ',
                },
                {
                  approvalDate: null,
                  contractDate: '2024-05-27T00:00:00.000Z',
                  lastDebitDate: null,
                  leaseEndDate: null,
                  leaseId: '211-724-00-0027/02',
                  leaseNumber: '02',
                  leaseStartDate: '2024-05-27T00:00:00.000Z',
                  noticeDate: null,
                  noticeGivenBy: null,
                  noticeTimeTenant: 3,
                  preferredMoveOutDate: null,
                  rentalPropertyId: '211-724-00-0027',
                  residentialArea: {
                    caption: 'Bäckby',
                    code: 'BÄC',
                  },
                  tenantContactIds: [],
                  tenants: [],
                  terminationDate: null,
                  type: 'P-Platskontrakt               ',
                },
              ],
              priority: 3,
              queuePoints: 75,
              status: 5,
            },
            {
              address: {
                city: 'VÄSTERÅS',
                number: '',
                postalCode: '72222',
                street: 'Fiktiggatan 1',
              },
              applicationDate: '2024-04-19T12:18:01.1400000',
              applicationType: 'Byte',
              contactCode: 'P145241',
              currentHousingContract: {
                approvalDate: '2023-09-27T00:00:00.000Z',
                contractDate: '2023-09-27T00:00:00.000Z',
                lastDebitDate: null,
                leaseEndDate: null,
                leaseId: '306-001-01-0101/07',
                leaseNumber: '07',
                leaseStartDate: '2024-01-01T00:00:00.000Z',
                noticeDate: null,
                noticeGivenBy: null,
                noticeTimeTenant: 3,
                preferredMoveOutDate: null,
                rentalPropertyId: '306-001-01-0101',
                residentialArea: {
                  caption: 'Pettersberg',
                  code: 'PET',
                },
                tenantContactIds: [],
                tenants: [],
                terminationDate: null,
                type: 'Bostadskontrakt               ',
              },
              id: 1002,
              listingId: 3,
              name: 'Lars Andersson',
              nationalRegistrationNumber: '19871133-2222',
              parkingSpaceContracts: [],
              queuePoints: 1792,
              status: 5,
            },
            {
              address: {
                city: 'Västerås',
                number: '',
                postalCode: '722 09',
                street: 'Storagatan 2 B',
              },
              applicationDate: '2024-04-19T12:18:01.1400000',
              applicationType: 'Byte',
              contactCode: 'P066083',
              currentHousingContract: {
                approvalDate: '2019-09-04T00:00:00.000Z',
                contractDate: '2019-09-04T00:00:00.000Z',
                lastDebitDate: null,
                leaseEndDate: null,
                leaseId: '104-061-02-0202/11',
                leaseNumber: '11',
                leaseStartDate: '2019-10-01T00:00:00.000Z',
                noticeDate: null,
                noticeGivenBy: null,
                noticeTimeTenant: 3,
                preferredMoveOutDate: null,
                rentalPropertyId: '104-061-02-0202',
                residentialArea: {
                  caption: 'Centrum',
                  code: 'CEN',
                },
                tenantContactIds: [],
                tenants: [],
                terminationDate: null,
                type: 'Bostadskontrakt               ',
              },
              id: 2,
              listingId: 3,
              name: 'Bellman Olsson',
              nationalRegistrationNumber: '19881222-2345',
              parkingSpaceContracts: [],
              queuePoints: 705,
              status: 5,
            },
          ],
          status: '1',
          listingId: 3,
          offeredApplicant: {
            id: 1010,
            name: 'Testsson Stina',
            nationalRegistrationNumber: '195001182046',
            contactCode: 'P174965',
            applicationDate: '2024-05-29T06:01:17.323Z',
            applicationType: 'Replace',
            status: 1,
            listingId: 3,
          },
          createdAt: '2024-05-31T06:04:17.286Z',
          rentalObjectCode: '705-808-00-0009',
        },
      ]
      nock(config.tenantsLeasesService.url)
        .get('/contacts/P174965/offers')
        .reply(200, {
          data: mockedOffer,
        })

      const result = await leasingAdapter.getOffersForContact('P174965')
      expect(result.ok).toBe(true)

      if (result.ok) {
        expect(result.data).toEqual(mockedOffer)
      }
    })
  })
})
