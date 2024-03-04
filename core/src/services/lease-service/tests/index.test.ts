import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { routes } from '../index'
import * as tenantLeaseAdapter from '../../../adapters/leasing-adapter'
import { Contact, Lease, ConsumerReport } from 'onecore-types'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

describe('lease-service', () => {
  let leaseMock: Lease, contactMock: Contact, consumerReportMock: ConsumerReport

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
})
