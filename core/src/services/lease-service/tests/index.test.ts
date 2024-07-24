import axios from 'axios'
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

import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { routes } from '../index'
import * as tenantLeaseAdapter from '../../../adapters/leasing-adapter'

import {
  Contact,
  Lease,
  ConsumerReport,
  OfferWithRentalObjectCode,
  OfferStatus,
} from 'onecore-types'
import * as factory from '../../../../test/factories'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

describe('lease-service', () => {
  let leaseMock: Lease,
    contactMock: Contact,
    offersMock: Array<OfferWithRentalObjectCode>,
    consumerReportMock: ConsumerReport,
    listingWithDetailedApplicantsMock: any[] //todo: map to type when type defined

  beforeEach(() => {
    leaseMock = {
      leaseId: '1',
      leaseNumber: '9433',
      leaseStartDate: new Date('2023-06-01T09:57:53.144Z'),
      leaseEndDate: new Date('2023-06-01T09:57:53.144Z'),
      status: 0,
      tenantContactIds: ['P4417', 'P5602'],
      address: undefined,
      noticeGivenBy: undefined,
      noticeDate: undefined,
      noticeTimeTenant: undefined,
      preferredMoveOutDate: undefined,
      contractDate: undefined,
      terminationDate: undefined,
      lastDebitDate: undefined,
      approvalDate: undefined,
      tenants: [
        {
          contactCode: 'P4417',
          contactKey: 'ABC',
          firstName: 'Anneli',
          lastName: 'Forsberg',
          nationalRegistrationNumber: '20740522-7848',
          birthDate: new Date('20740522'),
          address: {
            street: 'Gatvägen',
            number: '29',
            postalCode: '72489',
            city: 'Västerås',
          },
          phoneNumbers: [
            {
              isMainNumber: true,
              phoneNumber: '+465480978306',
              type: 'mobile',
            },
            {
              isMainNumber: false,
              phoneNumber: '+460777174972',
              type: 'home',
            },
          ],
          emailAddress: 'test@test.se',
          leaseIds: ['1'],
          leases: undefined,
          fullName: 'Anneli Forsberg',
          isTenant: true,
        },
        {
          contactCode: 'P5602',
          contactKey: 'ABC',
          firstName: 'Berit',
          lastName: 'Holmgren',
          nationalRegistrationNumber: '20850523-6536',
          birthDate: new Date('20850523'),
          address: {
            street: 'Gatvägen',
            number: '29',
            postalCode: '72489',
            city: 'Västerås',
          },
          phoneNumbers: [
            {
              isMainNumber: true,
              phoneNumber: '+467932495313',
              type: 'mobile',
            },
            {
              isMainNumber: false,
              phoneNumber: '+469731498801',
              type: 'home',
            },
          ],
          emailAddress: 'test@test.se',
          leaseIds: ['1'],
          leases: undefined,
          fullName: 'Berit Holmgren',
          isTenant: true,
        },
      ],
      rentalPropertyId: '264',
      rentalProperty: undefined,
      type: 'type',
      rentInfo: undefined,
    }

    contactMock = {
      contactCode: 'P965339',
      contactKey: 'DEF',
      firstName: 'Erik',
      lastName: 'Lundberg',
      fullName: 'Erik Lundberg',
      nationalRegistrationNumber: '194512121122',
      birthDate: new Date('1945-12-12T00:00:00.000Z'),
      address: {
        street: 'Gatvägen',
        number: '56',
        postalCode: '72266',
        city: 'Västerås',
      },
      phoneNumbers: [
        {
          isMainNumber: true,
          phoneNumber: '+460759429414',
          type: 'mobile',
        },
        {
          isMainNumber: false,
          phoneNumber: '+465292643751',
          type: 'home',
        },
      ],
      emailAddress: 'erik.lundberg@mimer.nu',
      leaseIds: undefined,
      leases: undefined,
      isTenant: false,
    }

    offersMock = [
      {
        id: 3,
        sentAt: null,
        expiresAt: new Date('2024-05-15T13:19:27.000Z'),
        answeredAt: null,
        selectedApplicants: [
          {
            address: {
              city: 'JOHANNESHOV',
              number: '',
              postalCode: '12139',
              street: 'Testvägen 25',
            },
            applicationDate: new Date('2024-04-30T09:27:16.3440000'),
            applicationType: 'baz',
            contactCode: 'P174966',
            currentHousingContract: {
              approvalDate: new Date('2024-02-01T00:00:00.000Z'),
              contractDate: new Date('2024-02-01T00:00:00.000Z'),
              lastDebitDate: undefined,
              leaseEndDate: undefined,
              leaseId: '705-022-04-0201/11',
              leaseNumber: '11',
              leaseStartDate: new Date('2024-03-01T00:00:00.000Z'),
              noticeDate: undefined,
              noticeGivenBy: undefined,
              noticeTimeTenant: '3',
              preferredMoveOutDate: undefined,
              rentalPropertyId: '705-022-04-0201',
              residentialArea: { caption: 'Malmaberg', code: 'MAL' },
              tenantContactIds: [],
              tenants: [],
              terminationDate: undefined,
              type: 'Bostadskontrakt               ',
              status: 1,
              rentalProperty: undefined,
              rentInfo: undefined,
              address: undefined,
            },
            id: 1011,
            listingId: 4,
            name: 'Foo Bar',
            nationalRegistrationNumber: '19981123-0102',
            parkingSpaceContracts: [
              {
                approvalDate: new Date('2024-02-01T00:00:00.000Z'),
                contractDate: new Date('2024-02-01T00:00:00.000Z'),
                lastDebitDate: undefined,
                leaseEndDate: undefined,
                leaseId: '508-713-00-0009/19',
                leaseNumber: '19',
                leaseStartDate: new Date('2024-03-01T00:00:00.000Z'),
                noticeDate: undefined,
                noticeGivenBy: undefined,
                noticeTimeTenant: '3',
                preferredMoveOutDate: undefined,
                rentalPropertyId: '508-713-00-0009',
                residentialArea: { caption: 'Skallberget', code: 'SKA' },
                tenantContactIds: [],
                tenants: [],
                terminationDate: undefined,
                type: 'P-Platskontrakt               ',
                status: 1,
                rentalProperty: undefined,
                rentInfo: undefined,
                address: undefined,
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
            applicationDate: new Date('2024-04-19T12:18:01.1400000'),
            applicationType: 'Byte',
            contactCode: 'P145241',
            currentHousingContract: {
              approvalDate: new Date('2023-09-27T00:00:00.000Z'),
              contractDate: new Date('2023-09-27T00:00:00.000Z'),
              lastDebitDate: undefined,
              leaseEndDate: undefined,
              leaseId: '306-001-01-0101/07',
              leaseNumber: '07',
              leaseStartDate: new Date('2024-01-01T00:00:00.000Z'),
              noticeDate: undefined,
              noticeGivenBy: undefined,
              noticeTimeTenant: '3',
              preferredMoveOutDate: undefined,
              rentalPropertyId: '306-001-01-0101',
              residentialArea: { caption: 'Pettersberg', code: 'PET' },
              tenantContactIds: [],
              tenants: [],
              terminationDate: undefined,
              type: 'Bostadskontrakt               ',
              status: 1,
              rentalProperty: undefined,
              rentInfo: undefined,
              address: undefined,
            },
            id: 1012,
            listingId: 4,
            name: 'Lars Andersson',
            nationalRegistrationNumber: '19871133-2222',
            parkingSpaceContracts: [],
            queuePoints: 1792,
            status: 5,
          },
        ],
        status: OfferStatus.Active,
        listingId: 3,
        offeredApplicant: {
          id: 1010,
          name: 'Testsson Stina',
          nationalRegistrationNumber: '195001182046',
          contactCode: 'P174965',
          applicationDate: new Date('2024-05-29T06:01:17.323Z'),
          applicationType: 'Replace',
          status: 1,
          listingId: 3,
        },
        createdAt: new Date('2024-05-31T06:04:17.286Z'),
        rentalObjectCode: '705-808-00-0009',
      },
      {
        id: 3,
        sentAt: null,
        expiresAt: new Date('2024-05-15T13:19:27.000Z'),
        answeredAt: null,
        selectedApplicants: [
          {
            address: {
              city: 'JOHANNESHOV',
              number: '',
              postalCode: '12139',
              street: 'Testvägen 25',
            },
            applicationDate: new Date('2024-04-30T09:27:16.3440000'),
            applicationType: 'baz',
            contactCode: 'P174966',
            currentHousingContract: {
              approvalDate: new Date('2024-02-01T00:00:00.000Z'),
              contractDate: new Date('2024-02-01T00:00:00.000Z'),
              lastDebitDate: undefined,
              leaseEndDate: undefined,
              leaseId: '705-022-04-0201/11',
              leaseNumber: '11',
              leaseStartDate: new Date('2024-03-01T00:00:00.000Z'),
              noticeDate: undefined,
              noticeGivenBy: undefined,
              noticeTimeTenant: '3',
              preferredMoveOutDate: undefined,
              rentalPropertyId: '705-022-04-0201',
              residentialArea: { caption: 'Malmaberg', code: 'MAL' },
              tenantContactIds: [],
              tenants: [],
              terminationDate: undefined,
              type: 'Bostadskontrakt               ',
              status: 1,
              rentalProperty: undefined,
              rentInfo: undefined,
              address: undefined,
            },
            id: 1011,
            listingId: 4,
            name: 'Foo Bar',
            nationalRegistrationNumber: '19981123-0102',
            parkingSpaceContracts: [
              {
                approvalDate: new Date('2024-02-01T00:00:00.000Z'),
                contractDate: new Date('2024-02-01T00:00:00.000Z'),
                lastDebitDate: undefined,
                leaseEndDate: undefined,
                leaseId: '508-713-00-0009/19',
                leaseNumber: '19',
                leaseStartDate: new Date('2024-03-01T00:00:00.000Z'),
                noticeDate: undefined,
                noticeGivenBy: undefined,
                noticeTimeTenant: '3',
                preferredMoveOutDate: undefined,
                rentalPropertyId: '508-713-00-0009',
                residentialArea: { caption: 'Skallberget', code: 'SKA' },
                tenantContactIds: [],
                tenants: [],
                terminationDate: undefined,
                type: 'P-Platskontrakt               ',
                status: 1,
                rentalProperty: undefined,
                rentInfo: undefined,
                address: undefined,
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
            applicationDate: new Date('2024-04-19T12:18:01.1400000'),
            applicationType: 'Byte',
            contactCode: 'P145241',
            currentHousingContract: {
              approvalDate: new Date('2023-09-27T00:00:00.000Z'),
              contractDate: new Date('2023-09-27T00:00:00.000Z'),
              lastDebitDate: undefined,
              leaseEndDate: undefined,
              leaseId: '306-001-01-0101/07',
              leaseNumber: '07',
              leaseStartDate: new Date('2024-01-01T00:00:00.000Z'),
              noticeDate: undefined,
              noticeGivenBy: undefined,
              noticeTimeTenant: '3',
              preferredMoveOutDate: undefined,
              rentalPropertyId: '306-001-01-0101',
              residentialArea: { caption: 'Pettersberg', code: 'PET' },
              tenantContactIds: [],
              tenants: [],
              terminationDate: undefined,
              type: 'Bostadskontrakt               ',
              status: 1,
              rentalProperty: undefined,
              rentInfo: undefined,
              address: undefined,
            },
            id: 1012,
            listingId: 4,
            name: 'Lars Andersson',
            nationalRegistrationNumber: '19871133-2222',
            parkingSpaceContracts: [],
            queuePoints: 1792,
            status: 5,
          },
        ],
        status: OfferStatus.Active,
        listingId: 4,
        offeredApplicant: {
          id: 1010,
          name: 'Testsson Stina',
          nationalRegistrationNumber: '195001182046',
          contactCode: 'P174965',
          applicationDate: new Date('2024-05-29T06:01:17.323Z'),
          applicationType: 'Replace',
          status: 1,
          listingId: 4,
        },
        createdAt: new Date('2024-05-31T06:04:17.286Z'),
        rentalObjectCode: '705-808-00-0009',
      },
    ]
    consumerReportMock = {
      pnr: '4512121122',
      template: 'TEST_TEMPLATE',
      status: '2',
      status_text: 'Ej Godkänd',
      errorList: [
        {
          Cause_of_Reject: 'P24',
          Reject_comment: '',
          Reject_text: 'Scoring',
        },
      ],
      name: 'Erik Lundberg',
      address: 'Gatvägen 56',
      zip: '72266',
      city: 'Västerås',
    }

    listingWithDetailedApplicantsMock = [
      {
        id: 3005,
        name: 'Sökande Fiktiv',
        contactCode: 'P145241',
        applicationDate: '2024-04-30T14:39:55.1210000',
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
          type: 'Bostadskontrakt               ',
          leaseStartDate: '2024-01-01T00:00:00.000Z',
          leaseEndDate: null,
          tenantContactIds: [],
          tenants: [],
          noticeGivenBy: null,
          noticeDate: null,
          noticeTimeTenant: 3,
          preferredMoveOutDate: null,
          terminationDate: null,
          contractDate: '2023-09-27T00:00:00.000Z',
          lastDebitDate: null,
          approvalDate: '2023-09-27T00:00:00.000Z',
          residentalArea: {
            code: 'PET',
            caption: 'Pettersberg',
          },
        },
        upcomingHousingContract: null,
        parkingSpaceContracts: [],
      },
    ]
  })

  describe('GET /leases/for/:pnr', () => {
    it('responds with a list of leases', async () => {
      const getLeaseSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLeasesForPnr')
        .mockResolvedValue([leaseMock])

      const res = await request(app.callback()).get('/leases/for/101010-1010')
      expect(res.status).toBe(200)
      expect(getLeaseSpy).toHaveBeenCalled()
      expect(res.body.data).toBeInstanceOf(Array)
      expect(JSON.stringify(res.body.data[0])).toEqual(
        JSON.stringify(leaseMock)
      )
    })
  })

  describe('GET /leases/:id', () => {
    it('responds with lease', async () => {
      const getLeaseSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLease')
        .mockResolvedValue(leaseMock)

      const res = await request(app.callback()).get('/leases/1337')
      expect(res.status).toBe(200)
      expect(getLeaseSpy).toHaveBeenCalled()
      expect(JSON.stringify(res.body.data)).toEqual(JSON.stringify(leaseMock))
    })
  })

  describe('GET /contact/:pnr', () => {
    it('responds with a contact', async () => {
      const getContactSpy = jest
        .spyOn(tenantLeaseAdapter, 'getContactForPnr')
        .mockResolvedValue(contactMock)

      const res = await request(app.callback()).get('/contact/194512121122')

      expect(res.status).toBe(200)
      expect(getContactSpy).toHaveBeenCalled()
      expect(JSON.stringify(res.body.data)).toEqual(JSON.stringify(contactMock))
    })
  })

  describe('GET /contacts/:contactCode/offers', () => {
    it('responds with offers', async () => {
      const getOffersForContactSpy = jest
        .spyOn(tenantLeaseAdapter, 'getOffersForContact')
        .mockResolvedValueOnce({ ok: true, data: offersMock })

      const res = await request(app.callback()).get('/contacts/P174965/offers')

      expect(res.status).toBe(200)
      expect(getOffersForContactSpy).toHaveBeenCalled()
      expect(JSON.stringify(res.body.data)).toEqual(JSON.stringify(offersMock))
    })
  })

  describe('GET /cas/getConsumerReport/:pnr', () => {
    it('responds with a credit information', async () => {
      const getCreditInformationSpy = jest
        .spyOn(tenantLeaseAdapter, 'getCreditInformation')
        .mockResolvedValue(consumerReportMock)

      const res = await request(app.callback()).get(
        '/cas/getConsumerReport/194512121122'
      )

      expect(res.status).toBe(200)
      expect(getCreditInformationSpy).toHaveBeenCalled()
      expect(JSON.stringify(res.body.data)).toEqual(
        JSON.stringify(consumerReportMock)
      )
    })
  })

  describe('GET /listing/:listingId/applicants/details', () => {
    it('responds with a listing with detailed applicant data', async () => {
      const getListingByIdWithDetailedApplicantsSpy = jest
        .spyOn(tenantLeaseAdapter, 'getListingByIdWithDetailedApplicants')
        .mockResolvedValue(listingWithDetailedApplicantsMock)

      const res = await request(app.callback()).get(
        '/listing/1337/applicants/details'
      )

      expect(res.status).toBe(200)
      expect(getListingByIdWithDetailedApplicantsSpy).toHaveBeenCalled()
      expect(JSON.stringify(res.body)).toEqual(
        JSON.stringify(listingWithDetailedApplicantsMock)
      )
    })
  })

  describe('GET /contact/contactCode/:contactCode', () => {
    it('returns 200 and a contact', async () => {
      const contact = factory.contact.build()
      const getContactByContactCodeSpy = jest
        .spyOn(tenantLeaseAdapter, 'getContactByContactCode')
        .mockResolvedValueOnce({ ok: true, data: contact })

      const res = await request(app.callback()).get(
        `/contact/contactCode/${contact.contactCode}`
      )

      expect(res.status).toBe(200)
      expect(getContactByContactCodeSpy).toHaveBeenCalled()
      expect(JSON.stringify(res.body.data)).toEqual(JSON.stringify(contact))
    })

    it('returns 404 if no contact', async () => {
      const contact = factory.contact.build()
      const getContactByContactCodeSpy = jest
        .spyOn(tenantLeaseAdapter, 'getContactByContactCode')
        .mockResolvedValueOnce({ ok: false, err: 'not-found' })

      const res = await request(app.callback()).get(
        `/contact/contactCode/${contact.contactCode}`
      )

      expect(res.status).toBe(404)
      expect(getContactByContactCodeSpy).toHaveBeenCalled()
    })
  })

  describe('GET /contacts/search', () => {
    it('returns 400 if missing query param', async () => {
      const res = await request(app.callback()).get(`/contacts/search`)

      expect(res.status).toBe(400)
    })

    it('returns 200 and a list of contact data', async () => {
      const contacts = factory.contact
        .buildList(1)
        .map(({ fullName, contactCode }) => ({ fullName, contactCode }))

      const getContactsDataBySearchQuery = jest
        .spyOn(tenantLeaseAdapter, 'getContactsDataBySearchQuery')
        .mockResolvedValueOnce({
          ok: true,
          data: contacts,
        })

      const res = await request(app.callback()).get(`/contacts/search?q=foo`)

      expect(res.status).toBe(200)
      expect(getContactsDataBySearchQuery).toHaveBeenCalled()
      expect(res.body.data).toEqual(contacts)
    })
  })
})
