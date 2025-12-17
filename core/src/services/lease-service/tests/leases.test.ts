import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { Lease } from '@onecore/types'

import { routes } from '../index'
import * as tenantLeaseAdapter from '../../../adapters/leasing-adapter'
import * as factory from '../../../../test/factories'
import { Lease as LeaseSchema } from '../schemas/lease'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

beforeEach(jest.resetAllMocks)
describe('leases routes', () => {
  const leaseMock: Lease = factory.lease.build()

  describe('GET /leases/by-rental-object-code/:rentalObjectCode', () => {
    it('responds with 400 for invalid query parameters', async () => {
      const res = await request(app.callback()).get(
        '/leases/by-rental-object-code/123?includeContacts=invalid'
      )

      expect(res.status).toBe(400)
      expect(res.body).toMatchObject({
        reason: 'Invalid query parameters',
        error: expect.any(Object),
      })
    })

    it('responds with 400 for invalid query parameters', async () => {
      const res = await request(app.callback()).get(
        '/leases/by-rental-object-code/123?status=invalid'
      )

      expect(res.status).toBe(400)
      expect(res.body).toMatchObject({
        reason: 'Invalid query parameters',
        error: expect.any(Object),
      })
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'getLeasesByRentalObjectCode')
        .mockRejectedValue(new Error('Adapter error'))

      const res = await request(app.callback()).get(
        '/leases/by-rental-object-code/123'
      )

      expect(res.status).toBe(500)
    })

    it('responds with a list of leases for valid query parameters', async () => {
      const getLeasesByRentalObjectCodeSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLeasesByRentalObjectCode')
        .mockResolvedValue(factory.lease.buildList(1))

      const res = await request(app.callback()).get(
        '/leases/by-rental-object-code/123?status=current&includeContacts=true'
      )

      expect(res.status).toBe(200)
      expect(getLeasesByRentalObjectCodeSpy).toHaveBeenCalledWith(
        '123',
        expect.objectContaining({
          status: ['current'],
          includeContacts: true,
        })
      )

      expect(() => LeaseSchema.array().parse(res.body.content)).not.toThrow()
    })
  })

  describe('GET /leases/by-contact-code/:contactCode', () => {
    it('responds with 400 for invalid query parameters', async () => {
      const res = await request(app.callback()).get(
        '/leases/by-contact-code/123?includeContacts=invalid'
      )

      expect(res.status).toBe(400)
      expect(res.body).toMatchObject({
        reason: 'Invalid query parameters',
        error: expect.any(Object),
      })
    })

    it('responds with 400 for invalid query parameters', async () => {
      const res = await request(app.callback()).get(
        '/leases/by-contact-code/123?status=invalid'
      )

      expect(res.status).toBe(400)
      expect(res.body).toMatchObject({
        reason: 'Invalid query parameters',
        error: expect.any(Object),
      })
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'getLeasesByContactCode')
        .mockRejectedValue(new Error('Adapter error'))

      const res = await request(app.callback()).get(
        '/leases/by-contact-code/123'
      )

      expect(res.status).toBe(500)
    })

    it('responds with a list of leases for valid query parameters', async () => {
      const getLeasesByContactCodeSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLeasesByContactCode')
        .mockResolvedValue([leaseMock])

      const res = await request(app.callback()).get(
        '/leases/by-contact-code/123?status=current,upcoming,about-to-end&includeContacts=true'
      )

      expect(res.status).toBe(200)
      expect(getLeasesByContactCodeSpy).toHaveBeenCalledWith(
        '123',
        expect.objectContaining({
          status: ['current', 'upcoming', 'about-to-end'],
          includeContacts: true,
        })
      )

      expect(JSON.stringify(res.body.content[0])).toEqual(
        JSON.stringify(leaseMock)
      )
    })
  })

  describe('GET /leases/by-pnr/:pnr', () => {
    it('responds with a list of leases', async () => {
      const getContactForPnrSpy = jest
        .spyOn(tenantLeaseAdapter, 'getContactForPnr')
        .mockResolvedValue(factory.contact.build())
      const getLeasesSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLeasesByContactCode')
        .mockResolvedValue([leaseMock])

      const res = await request(app.callback()).get(
        '/leases/by-pnr/101010-1010'
      )
      expect(res.status).toBe(200)
      expect(getLeasesSpy).toHaveBeenCalled()
      expect(res.body.content).toBeInstanceOf(Array)
      expect(JSON.stringify(res.body.content[0])).toEqual(
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
      expect(JSON.stringify(res.body.content)).toEqual(
        JSON.stringify(leaseMock)
      )
    })
  })
})
