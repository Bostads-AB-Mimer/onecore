import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { routes } from '../index'
import * as tenantLeaseAdapter from '../adapters/tenant-lease-adapter'
import { Contact, Lease, RentalProperty } from 'onecore-types'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

describe('lease-service', () => {
  let leaseMock: Lease, contactMock: Contact

  beforeEach(() => {
    leaseMock = {
      leaseId: '1',
      leaseNumber: '9433',
      leaseStartDate: new Date('2023-06-01T09:57:53.144Z'),
      leaseEndDate: new Date('2023-06-01T09:57:53.144Z'),
      status: 0,
      tenantContactIds: ['4417', '5602'],
      tenants: [
        {
          contactId: '4417',
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
          mobilePhone: '+465480978306',
          phoneNumber: '+460777174972',
          emailAddress: 'test@test.se',
          leaseId: '1',
          lease: undefined,
          fullName: 'Anneli Forsberg',
          type: 'type',
          lastUpdated: undefined,
        },
        {
          contactId: '5602',
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
          mobilePhone: '+467932495313',
          phoneNumber: '+469731498801',
          emailAddress: 'test@test.se',
          leaseId: '1',
          lease: undefined,
          fullName: 'Anneli Forsberg',
          type: 'type',
          lastUpdated: undefined,
        },
      ],
      rentalPropertyId: '264',
      rentalProperty: undefined,
      type: 'type',
      rentInfo: undefined,
      lastUpdated: undefined,
    }

    contactMock = {
      contactId: 'P965339',
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
      mobilePhone: '+460759429414',
      phoneNumber: '+465292643751',
      emailAddress: 'erik.lundberg@mimer.nu',
      leaseId: undefined,
      lease: undefined,
      lastUpdated: undefined,
      type: 'type',
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
})
