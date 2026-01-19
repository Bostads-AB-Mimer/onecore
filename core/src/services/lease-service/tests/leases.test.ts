import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { Lease, schemas } from '@onecore/types'

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

  describe('POST /leases/:leaseId/rent-rows', () => {
    const rentRow = {
      amount: 115,
      articleId: '12334567',
      label: 'Hyra p-plats',
      from: new Date('2024-01-01'),
    }

    it('validates request body', async () => {
      const res = await request(app.callback()).post('/leases/1337/rent-rows')

      expect(res.status).toBe(400)
    })

    it('returns 500 when adapter returns error', async () => {
      const createRentRowSpy = jest
        .spyOn(tenantLeaseAdapter, 'createLeaseRentRow')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback())
        .post('/leases/1337/rent-rows')
        .send(rentRow)

      expect(res.status).toBe(500)
      expect(createRentRowSpy).toHaveBeenCalledWith({
        leaseId: '1337',
        rentRow: { ...rentRow, from: new Date(rentRow.from) },
      })
    })

    it('creates rent row even without from/to', async () => {
      const minimalRentRow = {
        amount: 200,
        articleId: 'Rent-001',
        label: 'Rent',
      }

      const createRentRowSpy = jest
        .spyOn(tenantLeaseAdapter, 'createLeaseRentRow')
        .mockResolvedValue({
          ok: true,
          data: null,
        })

      const res = await request(app.callback())
        .post('/leases/1337/rent-rows')
        .send(minimalRentRow)

      expect(res.status).toBe(201)
      expect(createRentRowSpy).toHaveBeenCalledWith({
        leaseId: '1337',
        rentRow: minimalRentRow,
      })
      expect(res.body.content).toEqual(null)
    })

    it('creates rent row', async () => {
      const createRentRowSpy = jest
        .spyOn(tenantLeaseAdapter, 'createLeaseRentRow')
        .mockResolvedValue({
          ok: true,
          data: null,
        })

      const res = await request(app.callback())
        .post('/leases/1337/rent-rows')
        .send(rentRow)

      expect(res.status).toBe(201)
      expect(createRentRowSpy).toHaveBeenCalledWith({
        leaseId: '1337',
        rentRow: { ...rentRow, from: new Date(rentRow.from) },
      })
      expect(res.body.content).toEqual(null)
    })
  })

  describe('DELETE /leases/:leaseId/rent-rows/:rentRowId', () => {
    it('returns 500 when adapter returns error', async () => {
      const deleteRentRowSpy = jest
        .spyOn(tenantLeaseAdapter, 'deleteLeaseRentRow')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).delete(
        '/leases/1337/rent-rows/row-1'
      )

      expect(res.status).toBe(500)
      expect(deleteRentRowSpy).toHaveBeenCalledWith({
        leaseId: '1337',
        rentRowId: 'row-1',
      })
    })

    it('deletes rent row', async () => {
      const deleteRentRowSpy = jest
        .spyOn(tenantLeaseAdapter, 'deleteLeaseRentRow')
        .mockResolvedValue({ ok: true, data: null })

      const res = await request(app.callback()).delete(
        '/leases/1337/rent-rows/row-1'
      )

      expect(res.status).toBe(200)
      expect(deleteRentRowSpy).toHaveBeenCalledWith({
        leaseId: '1337',
        rentRowId: 'row-1',
      })
      expect(res.body.content).toBeNull()
    })
  })

  describe('GET /rent-articles', () => {
    it('returns articles', async () => {
      const articles = [
        {
          includeInContract: false,
          id: 'article-1',
          title: 'Hyra bostad, konto 3011',
          defaultLabel: 'Hyra bostad, konto 3011',
          code: 'HYRAB1',
          accountNr: '3011',
          vat: 0.25,
          description: 'Test description',
          category: 'article-category',
          createdAt: new Date('2025-04-01T06:43:01.728Z'),
          updatedAt: new Date('2025-04-02T06:43:01.728Z'),
          hyresvard: 'hyresvard-1',
        },
      ]

      jest.spyOn(tenantLeaseAdapter, 'getRentArticles').mockResolvedValue({
        ok: true,
        data: articles,
      })

      const res = await request(app.callback()).get('/rent-articles')

      expect(res.status).toBe(200)
      expect(() =>
        schemas.v1.RentArticleSchema.array().parse(res.body.content)
      ).not.toThrow()
    })

    it('returns 500 on error', async () => {
      jest.spyOn(tenantLeaseAdapter, 'getRentArticles').mockResolvedValue({
        ok: false,
        err: 'unknown',
      })

      const res = await request(app.callback()).get('/rent-articles')

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('unknown')
    })
  })
})
