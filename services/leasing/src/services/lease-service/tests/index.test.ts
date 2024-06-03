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
  }
})

import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { Lease, Listing } from 'onecore-types'

import { routes } from '../index'
import * as tenantLeaseAdapter from '../adapters/xpand/tenant-lease-adapter'
import * as xpandSoapAdapter from '../adapters/xpand/xpand-soap-adapter'
import * as listingAdapter from '../adapters/listing-adapter'
import * as priorityListService from '../priority-list-service'
import { leaseTypes } from '../../../constants/leaseTypes'
import {
  ApplicantFactory,
  DetailedApplicantFactory,
  LeaseFactory,
  ListingFactory,
} from './factory'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

// Mock until this bug is fixed: https://github.com/kulshekhar/ts-jest/issues/3397
const LeaseStatus = {
  Active: 0,
}

describe('lease-service', () => {
  const leaseMock: Array<Lease> = [
    {
      leaseId: '406-097-11-0201/06',
      leaseNumber: '06',
      leaseStartDate: new Date('2023-09-07T00:00:00.000Z'),
      leaseEndDate: new Date('2024-09-07T00:00:00.000Z'),
      status: LeaseStatus.Active,
      tenantContactIds: ['P174958'],
      tenants: [
        {
          contactCode: 'P174958',
          contactKey: 'P124854',
          firstName: 'Kalle',
          lastName: 'Testsson',
          fullName: 'Testsson Kalle',
          leaseIds: ['406-097-11-0201/06'],
          nationalRegistrationNumber: '200009092388',
          birthDate: new Date('2000-09-09T00:00:00.000Z'),
          address: {
            street: 'Bovägen',
            number: '12',
            postalCode: '12345',
            city: 'Westeros',
          },
          phoneNumbers: [
            {
              phoneNumber: '+460123456789',
              type: 'mobtel',
              isMainNumber: true,
            },
          ],
          emailAddress: 'kalle.testsson@test.se',
          isTenant: true,
        },
      ],
      address: {
        street: 'Bovägen',
        number: '12',
        postalCode: '12345',
        city: 'Westeros',
      },
      rentalPropertyId: '406-097-11-0201',
      type: leaseTypes.housingContract,
      rentalProperty: undefined,
      rentInfo: undefined,
      noticeGivenBy: '',
      noticeDate: undefined,
      noticeTimeTenant: '3',
      preferredMoveOutDate: undefined,
      terminationDate: undefined,
      contractDate: new Date('2023-08-11T07:45:09.833Z'),
      lastDebitDate: undefined,
      approvalDate: new Date('2023-08-11T07:45:09.833Z'),
      residentialArea: {
        code: 'MAL',
        caption: 'Malmaberg',
      },
    },
    {
      leaseId: '102-008-03-0202/07',
      leaseNumber: '',
      leaseStartDate: new Date('2010-12-01T00:00:00.000Z'),
      leaseEndDate: undefined,
      status: LeaseStatus.Active,
      tenantContactIds: ['P965338'],
      tenants: [
        {
          contactCode: 'P965338',
          contactKey: 'P965432',
          firstName: 'Maj-Britt',
          lastName: 'Lundberg',
          fullName: 'Maj-Britt Lundberg',
          leaseIds: ['102-008-03-0202/07'],
          nationalRegistrationNumber: '194808075577',
          birthDate: new Date('1948-08-07T00:00:00.000Z'),
          address: {
            street: 'Gatvägen',
            number: '56',
            postalCode: '72266',
            city: 'Västerås',
          },
          phoneNumbers: [
            {
              phoneNumber: '+460759429414',
              type: 'mobtel',
              isMainNumber: true,
            },
          ],
          emailAddress: 'majbritt-123@mimer.nu',
          isTenant: true,
        },
      ],
      address: {
        street: 'Bovägen',
        number: '12',
        postalCode: '12345',
        city: 'Westeros',
      },
      rentalPropertyId: '102-008-03-0202',
      type: leaseTypes.housingContract,
      rentalProperty: undefined,
      rentInfo: undefined,
      noticeGivenBy: '',
      noticeDate: undefined,
      noticeTimeTenant: '3',
      preferredMoveOutDate: undefined,
      terminationDate: undefined,
      contractDate: new Date('2023-08-11T07:45:09.833Z'),
      lastDebitDate: undefined,
      approvalDate: new Date('2023-08-11T07:45:09.833Z'),
      residentialArea: {
        code: 'MAL',
        caption: 'Malmaberg',
      },
    },
    {
      leaseId: '102-008-03-0202/07',
      leaseNumber: '07',
      leaseStartDate: new Date('2010-12-01T00:00:00.000Z'),
      leaseEndDate: undefined,
      status: LeaseStatus.Active,
      tenantContactIds: ['P965339'],
      tenants: [
        {
          contactCode: 'P965339',
          contactKey: 'P624393',
          firstName: 'Erik',
          lastName: 'Lundberg',
          fullName: 'Erik Lundberg',
          leaseIds: ['102-008-03-0202/07'],
          nationalRegistrationNumber: '194808075577',
          birthDate: new Date('1945-12-12T00:00:00.000Z'),
          address: {
            street: 'Gatvägen',
            number: '56',
            postalCode: '72266',
            city: 'Västerås',
          },
          phoneNumbers: [
            {
              phoneNumber: '+460759429414',
              type: 'mobtel',
              isMainNumber: true,
            },
          ],
          emailAddress: 'erik.lundberg@mimer.nu',
          isTenant: true,
        },
      ],
      address: {
        street: 'Bovägen',
        number: '12',
        postalCode: '12345',
        city: 'Westeros',
      },
      rentalPropertyId: '102-008-03-0202',
      type: leaseTypes.housingContract,
      rentalProperty: undefined,
      rentInfo: undefined,
      noticeGivenBy: '',
      noticeDate: undefined,
      noticeTimeTenant: '3',
      preferredMoveOutDate: undefined,
      terminationDate: undefined,
      contractDate: new Date('2023-08-11T07:45:09.833Z'),
      lastDebitDate: undefined,
      approvalDate: new Date('2023-08-11T07:45:09.833Z'),
      residentialArea: {
        code: 'MAL',
        caption: 'Malmaberg',
      },
    },
  ]

  const listingMock: Listing = {
    id: 3030,
    rentalObjectCode: '705-808-00-0006',
    address: 'Svarvargatan 4',
    monthlyRent: 698.33,
    districtCaption: 'Malmaberg',
    districtCode: 'MAL',
    blockCaption: 'LINDAREN 2',
    blockCode: '1401',
    objectTypeCaption: 'Carport',
    objectTypeCode: 'CPORT',
    rentalObjectTypeCaption: 'Standard hyresobjektstyp',
    rentalObjectTypeCode: 'STD',
    publishedFrom: new Date(),
    publishedTo: new Date(),
    vacantFrom: new Date(),
    status: 1,
    waitingListType: 'Bilplats (intern)',
    applicants: [
      {
        id: 3005,
        nationalRegistrationNumber: '194808075577',
        name: 'Sökande Fiktiv',
        contactCode: 'P145241',
        applicationDate: new Date(),
        applicationType: 'Additional',
        status: 1,
        listingId: 3030,
      },
      {
        id: 3006,
        nationalRegistrationNumber: '198001011234',
        name: 'Testsson Stina',
        contactCode: 'P174965',
        applicationDate: new Date(),
        applicationType: 'Additional',
        status: 1,
        listingId: 3030,
      },
    ],
  }
  const detailedApplicantMock =
    //todo: update when type interface defined
    {
      id: 3005,
      name: 'Sökande Fiktiv',
      contactCode: 'P145241',
      applicationDate: new Date(),
      applicationType: 'Additional',
      status: 1,
      listingId: 3030,
      queuePoints: 1761,
      address: {
        street: 'Fiktiggatan 1',
        number: '',
        postalCode: '72222',
        city: 'VÄSTERÅS',
      },
      currentHousingContract: {
        leaseId: '306-001-01-0101/07',
        leaseNumber: '07',
        rentalPropertyId: '306-001-01-0101',
        type: leaseTypes.housingContract,
        leaseStartDate: new Date(),
        leaseEndDate: null,
        tenantContactIds: [],
        tenants: [],
        noticeGivenBy: null,
        noticeDate: null,
        noticeTimeTenant: 3,
        preferredMoveOutDate: null,
        terminationDate: null,
        contractDate: new Date(),
        lastDebitDate: null,
        approvalDate: new Date(),
        residentialArea: {
          code: 'PET',
          caption: 'Pettersberg',
        },
      },
      upcomingHousingContract: null,
      parkingSpaceContracts: [],
    }

  describe('GET /getLeasesForNationalRegistrationNumber', () => {
    it('responds with an array of leases', async () => {
      const getLeasesSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLeasesForNationalRegistrationNumber')
        .mockResolvedValueOnce(leaseMock)

      const res = await request(app.callback()).get(
        '/leases/for/nationalRegistrationNumber/194808075577'
      )
      expect(res.status).toBe(200)
      expect(res.body.data).toBeInstanceOf(Array)
      expect(getLeasesSpy).toHaveBeenCalled()
      expect(res.body.data.length).toBe(3)
    })
  })

  describe('GET /getLeasesForContactCode', () => {
    it('responds with an array of leases', async () => {
      const getLeasesSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLeasesForContactCode')
        .mockResolvedValueOnce(leaseMock)

      const res = await request(app.callback()).get(
        '/leases/for/contactCode/P965339'
      )
      expect(res.status).toBe(200)
      expect(res.body.data).toBeInstanceOf(Array)
      expect(getLeasesSpy).toHaveBeenCalled()
      expect(res.body.data.length).toBe(3)
    })
  })

  describe('GET /getLeasesForPropertyId', () => {
    it('responds with an array of leases', async () => {
      const getLeasesSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLeasesForPropertyId')
        .mockResolvedValueOnce(leaseMock)

      const res = await request(app.callback()).get(
        '/leases/for/propertyId/110-007-01-0203'
      )
      expect(res.status).toBe(200)
      expect(res.body.data).toBeInstanceOf(Array)
      expect(getLeasesSpy).toHaveBeenCalled()
      expect(res.body.data.length).toBe(3)
    })
  })

  describe('GET /leases/:id', () => {
    it('responds with a lease', async () => {
      const getLeaseSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLease')
        .mockResolvedValueOnce(leaseMock[0])

      const res = await request(app.callback()).get('/leases/1337')
      expect(res.status).toBe(200)
      expect(getLeaseSpy).toHaveBeenCalled()

      expect(res.body.data.leaseId).toEqual('406-097-11-0201/06')
    })
  })

  describe('GET /listing/:listingId/applicants/details', () => {
    it('responds with 404 if no listing found', async () => {
      const getListingSpy = jest
        .spyOn(listingAdapter, 'getListingById')
        .mockResolvedValueOnce(undefined)

      const res = await request(app.callback()).get(
        '/listing/1337/applicants/details'
      )
      expect(getListingSpy).toHaveBeenCalled()
      expect(res.status).toBe(404)
    })
    it('responds with 200 on success', async () => {
      const getListingSpy = jest
        .spyOn(listingAdapter, 'getListingById')
        .mockResolvedValueOnce(listingMock)

      const priorityListServiceSpy = jest
        .spyOn(priorityListService, 'getDetailedApplicantInformation')
        .mockResolvedValue(detailedApplicantMock as any)

      const res = await request(app.callback()).get(
        '/listing/1337/applicants/details'
      )
      expect(getListingSpy).toHaveBeenCalled()
      expect(priorityListServiceSpy).toHaveBeenCalled()
      expect(res.status).toBe(200)
      expect(res.body).toBeDefined()
    })
  })

  describe('GET /applicants/:contactCode/:listingId', () => {
    it('responds with 404 if no listing found', async () => {
      const getListingSpy = jest
        .spyOn(listingAdapter, 'getApplicantByContactCodeAndListingId')
        .mockResolvedValueOnce(undefined)

      const res = await request(app.callback()).get('/applicants/123/456')
      expect(getListingSpy).toHaveBeenCalled()
      expect(res.status).toBe(404)
    })
    it('responds with 200 on success', async () => {
      const listing = ListingFactory.params({}).build()

      const applicant = ApplicantFactory.params({
        listingId: listing.id,
      }).build()

      const getListingSpy = jest
        .spyOn(listingAdapter, 'getApplicantByContactCodeAndListingId')
        .mockResolvedValue(applicant)

      const res = await request(app.callback()).get(
        `/applicants/${applicant.contactCode}/${listing.id}`
      )
      expect(getListingSpy).toHaveBeenCalled()
      expect(res.status).toBe(200)
      expect(res.body).toBeDefined()
      expect(res.body.id).toEqual(applicant.id)
      expect(res.body.listingId).toEqual(applicant.listingId)
      expect(res.body.name).toEqual(applicant.name)
      expect(res.body.contactCode).toEqual(applicant.contactCode)
      expect(res.body.applicationType).toEqual(applicant.applicationType)
    })
  })

  describe('POST /leases', () => {
    it('calls xpand adapter and returns id of new lease', async () => {
      const xpandAdapterSpy = jest
        .spyOn(xpandSoapAdapter, 'createLease')
        .mockResolvedValueOnce('123-123-123/1')

      const result = await request(app.callback()).post('/leases')

      expect(xpandAdapterSpy).toHaveBeenCalled()
      expect(result.body).toEqual({ LeaseId: '123-123-123/1' })
    })

    it('handles errors', async () => {
      const xpandAdapterSpy = jest
        .spyOn(xpandSoapAdapter, 'createLease')
        .mockImplementation(() => {
          throw new Error('Oh no')
        })

      const result = await request(app.callback()).post('/leases')

      expect(xpandAdapterSpy).toHaveBeenCalled

      expect(result.body).toEqual({ error: 'Oh no' })
    })
  })

  describe('isLeaseActive', () => {
    it('should return true if leaseStartDate is in the past and no lastDebitDate', () => {
      const lease = leaseMock[0]
      lease.leaseStartDate = new Date(Date.now() - 1000 * 60 * 60 * 24)
      lease.lastDebitDate = undefined

      expect(tenantLeaseAdapter.isLeaseActive(lease)).toBe(true)
    })

    it('should return true if leaseStartDate is in the past and lastDebitDate is in the future', () => {
      const lease = leaseMock[0]
      lease.leaseStartDate = new Date(Date.now() - 1000 * 60 * 60 * 24)
      lease.lastDebitDate = new Date(Date.now() + 1000 * 60 * 60 * 24)

      expect(tenantLeaseAdapter.isLeaseActive(lease)).toBe(true)
    })

    it('should return false if leaseStartDate is in the future', () => {
      const lease = leaseMock[0]
      lease.leaseStartDate = new Date(Date.now() + 1000 * 60 * 60 * 24)
      lease.lastDebitDate = new Date(Date.now() + 2000 * 60 * 60 * 24)

      expect(tenantLeaseAdapter.isLeaseActive(lease)).toBe(false)
    })

    it('should return false if lastDebitDate is in the past', () => {
      const lease = leaseMock[0]
      lease.leaseStartDate = new Date(Date.now() - 1000 * 60 * 60 * 24)
      lease.lastDebitDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 2)

      expect(tenantLeaseAdapter.isLeaseActive(lease)).toBe(false)
    })
  })
})
