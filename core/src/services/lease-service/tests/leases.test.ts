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

  describe('POST /leases/:leaseId/invoice-rows', () => {
    const invoiceRow = {
      amount: 115,
      article: '12334567',
      label: 'Hyra p-plats',
      from: new Date('2024-01-01'),
    }

    it('validates request body', async () => {
      const res = await request(app.callback()).post(
        '/leases/1337/invoice-rows'
      )

      expect(res.status).toBe(400)
    })

    it('returns 500 when adapter returns error', async () => {
      const createInvoiceRowSpy = jest
        .spyOn(tenantLeaseAdapter, 'createInvoiceRow')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback())
        .post('/leases/1337/invoice-rows')
        .send(invoiceRow)

      expect(res.status).toBe(500)
      expect(createInvoiceRowSpy).toHaveBeenCalledWith({
        leaseId: '1337',
        invoiceRow: { ...invoiceRow, from: new Date(invoiceRow.from) },
      })
    })

    it('creates invoice row even without from/to', async () => {
      const minimalInvoiceRow = {
        amount: 200,
        article: 'Rent-001',
        label: 'Rent',
      }

      const createInvoiceRowSpy = jest
        .spyOn(tenantLeaseAdapter, 'createInvoiceRow')
        .mockResolvedValue({
          ok: true,
          data: { ...minimalInvoiceRow, vat: 0.25, _id: 'row-id' },
        })

      const res = await request(app.callback())
        .post('/leases/1337/invoice-rows')
        .send(minimalInvoiceRow)

      expect(res.status).toBe(201)
      expect(createInvoiceRowSpy).toHaveBeenCalledWith({
        leaseId: '1337',
        invoiceRow: minimalInvoiceRow,
      })
      expect(res.body.content).toEqual({
        ...minimalInvoiceRow,
        vat: 0.25,
        _id: 'row-id',
      })
    })

    it('creates invoice row', async () => {
      const createInvoiceRowSpy = jest
        .spyOn(tenantLeaseAdapter, 'createInvoiceRow')
        .mockResolvedValue({
          ok: true,
          data: {
            ...invoiceRow,
            from: invoiceRow.from?.toISOString(),
            vat: 0.25,
            _id: 'row-id',
          },
        })

      const res = await request(app.callback())
        .post('/leases/1337/invoice-rows')
        .send(invoiceRow)

      expect(res.status).toBe(201)
      expect(createInvoiceRowSpy).toHaveBeenCalledWith({
        leaseId: '1337',
        invoiceRow: { ...invoiceRow, from: new Date(invoiceRow.from) },
      })
      expect(res.body.content).toEqual({
        ...invoiceRow,
        from: invoiceRow.from.toISOString(),
        vat: 0.25,
        _id: 'row-id',
      })
    })
  })

  describe('DELETE /leases/:leaseId/invoice-rows/:invoiceRowId', () => {
    it('returns 500 when adapter returns error', async () => {
      const deleteInvoiceRowSpy = jest
        .spyOn(tenantLeaseAdapter, 'deleteInvoiceRow')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).delete(
        '/leases/1337/invoice-rows/row-1'
      )

      expect(res.status).toBe(500)
      expect(deleteInvoiceRowSpy).toHaveBeenCalledWith({
        leaseId: '1337',
        invoiceRowId: 'row-1',
      })
    })

    it('deletes invoice row', async () => {
      const deleteInvoiceRowSpy = jest
        .spyOn(tenantLeaseAdapter, 'deleteInvoiceRow')
        .mockResolvedValue({ ok: true, data: null })

      const res = await request(app.callback()).delete(
        '/leases/1337/invoice-rows/row-1'
      )

      expect(res.status).toBe(200)
      expect(deleteInvoiceRowSpy).toHaveBeenCalledWith({
        leaseId: '1337',
        invoiceRowId: 'row-1',
      })
      expect(res.body.content).toBeNull()
    })
  })

  describe('GET /articles', () => {
    it('returns articles', async () => {
      const articles = [
        {
          includeInContract: false,
          _id: 'article-1',
          title: 'Hyra bostad, konto 3011',
          label: 'Hyra bostad, konto 3011',
          defaultLabel: 'Hyra bostad, konto 3011',
          code: 'HYRAB1',
          accountNr: '3011',
          vat: 0.25,
          description: 'Test description',
          category: 'article-category',
          adjustmentType: 'none' as const,
          archivedAt: null,
          createdAt: new Date('2025-04-01T06:43:01.728Z'),
          updatedAt: new Date('2025-04-02T06:43:01.728Z'),
          hyresvard: 'hyresvard-1',
          type: 'HYRAB1',
        },
      ]

      jest.spyOn(tenantLeaseAdapter, 'getArticles').mockResolvedValue({
        ok: true,
        data: articles,
      })

      const res = await request(app.callback()).get('/articles')

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual(articles)
    })

    it('returns 500 on error', async () => {
      jest.spyOn(tenantLeaseAdapter, 'getArticles').mockResolvedValue({
        ok: false,
        err: 'unknown',
      })

      const res = await request(app.callback()).get('/articles')

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('unknown')
    })
  })
})
