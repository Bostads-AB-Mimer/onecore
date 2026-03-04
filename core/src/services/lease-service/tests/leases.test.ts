import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { Lease, schemas } from '@onecore/types'

import { routes } from '../index'
import * as tenantLeaseAdapter from '../../../adapters/leasing-adapter'
import * as propertyBaseAdapter from '../../../adapters/property-base-adapter'
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
        '/leases/by-rental-object-code/123?status=current'
      )

      expect(res.status).toBe(200)
      expect(getLeasesByRentalObjectCodeSpy).toHaveBeenCalledWith(
        '123',
        expect.objectContaining({
          status: ['current'],
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
      jest
        .spyOn(tenantLeaseAdapter, 'getContactByContactCode')
        .mockResolvedValueOnce({ ok: true, data: factory.contact.build() })

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

      expect(() => LeaseSchema.array().parse(res.body.content)).not.toThrow()
    })
  })

  describe('GET /leases/by-pnr/:pnr', () => {
    it('responds with a list of leases', async () => {
      jest
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
      expect(() => LeaseSchema.array().parse(res.body.content)).not.toThrow()
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
      expect(() => LeaseSchema.parse(res.body.content)).not.toThrow()
    })

    it('responds with lease with contacts', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'getLease')
        .mockResolvedValue({ ...leaseMock, tenantContactIds: ['123'] })

      const getContactSpy = jest
        .spyOn(tenantLeaseAdapter, 'getContactByContactCode')
        .mockResolvedValue({ ok: true, data: factory.contact.build() })

      const res = await request(app.callback()).get(
        '/leases/1337?includeContacts=true'
      )
      expect(getContactSpy).toHaveBeenCalledWith('123')
      expect(res.status).toBe(200)
      expect(() => LeaseSchema.parse(res.body.content)).not.toThrow()
    })
  })

  describe('GET /leases/:leaseId/home-insurance', () => {
    it('responds with 404 when lease is missing', async () => {
      const getHomeInsuranceSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLeaseHomeInsurance')
        .mockResolvedValue({ ok: false, err: 'not-found' })

      const res = await request(app.callback()).get(
        '/leases/1337/home-insurance'
      )

      expect(res.status).toBe(404)
      expect(getHomeInsuranceSpy).toHaveBeenCalledWith('1337')
    })

    it('responds with home insurance', async () => {
      const responsePayload = {
        monthlyAmount: 123,
        from: '2024-01',
        to: '2024-12',
      }
      const getHomeInsuranceSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLeaseHomeInsurance')
        .mockResolvedValue({ ok: true, data: responsePayload })

      const res = await request(app.callback()).get(
        '/leases/1337/home-insurance'
      )

      expect(res.status).toBe(200)
      expect(getHomeInsuranceSpy).toHaveBeenCalledWith('1337')
      expect(() =>
        schemas.v1.LeaseHomeInsuranceSchema.parse(res.body.content)
      ).not.toThrow()
    })
  })

  describe('GET /leases/:leaseId/home-insurance/offer', () => {
    it('responds with home insurance offer', async () => {
      const getLeaseSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLease')
        .mockResolvedValue(leaseMock)

      jest
        .spyOn(propertyBaseAdapter, 'getResidenceByRentalId')
        .mockResolvedValue({
          ok: true,
          data: factory.residenceByRentalIdDetails.build({
            type: {
              roomCount: 1,
            },
          }),
        })

      const res = await request(app.callback()).get(
        '/leases/1337/home-insurance/offer'
      )

      expect(res.status).toBe(200)
      expect(getLeaseSpy).toHaveBeenCalledWith('1337')
      expect(() =>
        schemas.v1.LeaseHomeInsuranceOfferSchema.parse(res.body.content)
      ).not.toThrow()
    })
  })

  describe('POST /leases/:leaseId/home-insurance', () => {
    it('returns 500 when adapter returns error', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'getLease')
        .mockResolvedValueOnce(leaseMock)

      jest
        .spyOn(propertyBaseAdapter, 'getResidenceByRentalId')
        .mockResolvedValueOnce({
          ok: true,
          data: factory.residenceByRentalIdDetails.build({
            type: {
              roomCount: 1,
            },
          }),
        })

      const addHomeInsuranceSpy = jest
        .spyOn(tenantLeaseAdapter, 'addLeaseHomeInsurance')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback())
        .post('/leases/1337/home-insurance')
        .send({ from: new Date('2024-01-01') })

      expect(res.status).toBe(500)
      expect(addHomeInsuranceSpy).toHaveBeenCalledWith('1337', {
        from: expect.any(Date),
        monthlyAmount: 69,
      })
    })

    it('adds home insurance rent row', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'getLease')
        .mockResolvedValueOnce(leaseMock)

      const addHomeInsuranceSpy = jest
        .spyOn(tenantLeaseAdapter, 'addLeaseHomeInsurance')
        .mockResolvedValueOnce({
          ok: true,
          data: null,
        })

      jest
        .spyOn(propertyBaseAdapter, 'getResidenceByRentalId')
        .mockResolvedValueOnce({
          ok: true,
          data: factory.residenceByRentalIdDetails.build({
            type: {
              roomCount: 1,
            },
          }),
        })

      const res = await request(app.callback())
        .post('/leases/1337/home-insurance')
        .send({ from: new Date('2024-01-01') })

      expect(res.status).toBe(200)
      expect(addHomeInsuranceSpy).toHaveBeenCalledWith('1337', {
        from: expect.any(Date),
        monthlyAmount: 69,
      })
      expect(res.body.content).toEqual(null)
    })
  })

  describe('POST /leases/:leaseId/home-insurance/cancel', () => {
    it('returns 500 when adapter returns error', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'getLease')
        .mockResolvedValueOnce(leaseMock)

      jest
        .spyOn(tenantLeaseAdapter, 'getLeaseHomeInsurance')
        .mockResolvedValueOnce({
          ok: true,
          data: { monthlyAmount: 123, from: '2024-01', to: '2024-12' },
        })

      const cancelHomeInsuranceSpy = jest
        .spyOn(tenantLeaseAdapter, 'cancelLeaseHomeInsurance')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback())
        .post('/leases/1337/home-insurance/cancel')
        .send({ endDate: new Date('2024-10-01') })

      expect(res.status).toBe(500)
      expect(cancelHomeInsuranceSpy).toHaveBeenCalledWith('1337', {
        endDate: expect.any(Date),
      })
    })

    it('deletes home insurance', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'getLease')
        .mockResolvedValueOnce(leaseMock)

      jest
        .spyOn(tenantLeaseAdapter, 'getLeaseHomeInsurance')
        .mockResolvedValueOnce({
          ok: true,
          data: { monthlyAmount: 123, from: '2024-01', to: '2024-12' },
        })

      const cancelHomeInsuranceSpy = jest
        .spyOn(tenantLeaseAdapter, 'cancelLeaseHomeInsurance')
        .mockResolvedValueOnce({ ok: true, data: null })

      const res = await request(app.callback())
        .post('/leases/1337/home-insurance/cancel')
        .send({ endDate: new Date('2024-10-01') })

      expect(res.status).toBe(200)
      expect(cancelHomeInsuranceSpy).toHaveBeenCalledWith('1337', {
        endDate: expect.any(Date),
      })
      expect(res.body.content).toBeNull()
    })
  })
})
