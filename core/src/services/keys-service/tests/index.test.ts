import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes } from '../index'
import * as keysAdapter from '../../../adapters/keys-adapter'
import * as factory from '../../../../test/factories'

// Mock logger to prevent errors in routes
jest.mock('@onecore/utilities', () => ({
  ...jest.requireActual('@onecore/utilities'),
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}))

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

beforeEach(jest.resetAllMocks)

describe('keys-service', () => {
  // ============================================================================
  // Keys Routes
  // ============================================================================

  describe('GET /keys', () => {
    it('responds with paginated keys on success', async () => {
      const paginatedResponse = {
        content: factory.key.buildList(2),
        _meta: { totalRecords: 2, page: 1, limit: 20, count: 2 },
        _links: [
          { href: '/keys?page=1&limit=20', rel: 'self' as const },
          { href: '/keys?page=1&limit=20', rel: 'first' as const },
          { href: '/keys?page=1&limit=20', rel: 'last' as const },
        ],
      }

      const listSpy = jest
        .spyOn(keysAdapter.KeysApi, 'list')
        .mockResolvedValue({ ok: true, data: paginatedResponse })

      const res = await request(app.callback()).get('/keys?page=1&limit=20')

      expect(res.status).toBe(200)
      expect(listSpy).toHaveBeenCalledWith(1, 20)
      expect(res.body.content).toHaveLength(2)
      expect(res.body._meta).toEqual({
        totalRecords: 2,
        page: 1,
        limit: 20,
        count: 2,
      })
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.KeysApi, 'list')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get('/keys')

      expect(res.status).toBe(500)
      expect(res.body).toMatchObject({ error: 'Internal server error' })
    })
  })

  describe('GET /keys/search', () => {
    it('responds with paginated search results', async () => {
      const paginatedResponse = {
        content: factory.key.buildList(1),
        _meta: { totalRecords: 1, page: 1, limit: 20, count: 1 },
        _links: [
          { href: '/keys/search?q=test&page=1&limit=20', rel: 'self' as const },
          {
            href: '/keys/search?q=test&page=1&limit=20',
            rel: 'first' as const,
          },
          { href: '/keys/search?q=test&page=1&limit=20', rel: 'last' as const },
        ],
      }

      const searchSpy = jest
        .spyOn(keysAdapter.KeysApi, 'search')
        .mockResolvedValue({ ok: true, data: paginatedResponse })

      const res = await request(app.callback()).get(
        '/keys/search?q=test&fields=keyName&page=1&limit=20'
      )

      expect(res.status).toBe(200)
      expect(searchSpy).toHaveBeenCalled()
      expect(res.body.content).toHaveLength(1)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.KeysApi, 'search')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get('/keys/search?q=test')

      expect(res.status).toBe(500)
    })
  })

  describe('GET /keys/by-rental-object/:rentalObjectCode', () => {
    it('responds with keys for rental object', async () => {
      const keys = factory.key.buildList(2)

      jest
        .spyOn(keysAdapter.KeysApi, 'getByRentalObjectCode')
        .mockResolvedValue({ ok: true, data: keys })

      const res = await request(app.callback()).get(
        '/keys/by-rental-object/123-456-789'
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveLength(2)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.KeysApi, 'getByRentalObjectCode')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get(
        '/keys/by-rental-object/123-456-789'
      )

      expect(res.status).toBe(500)
    })
  })

  describe('GET /keys/with-loan-status/:rentalObjectCode', () => {
    it('responds with keys with loan status', async () => {
      const mockKey = factory.key.build()
      const keysWithStatus = [
        {
          ...mockKey,
          activeLoanId: null,
          activeLoanContact: null,
          activeLoanContact2: null,
          activeLoanPickedUpAt: null,
          activeLoanAvailableFrom: null,
          prevLoanAvailableFrom: null,
          prevLoanContact: null,
          prevLoanContact2: null,
        },
      ]

      jest
        .spyOn(keysAdapter.KeysApi, 'getWithLoanStatus')
        .mockResolvedValue({ ok: true, data: keysWithStatus })

      const res = await request(app.callback()).get(
        '/keys/with-loan-status/123-456-789'
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveLength(1)
      expect(res.body.content[0]).toHaveProperty('activeLoanId')
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.KeysApi, 'getWithLoanStatus')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get(
        '/keys/with-loan-status/123-456-789'
      )

      expect(res.status).toBe(500)
    })
  })

  describe('GET /keys/:id', () => {
    it('responds with key on success', async () => {
      const key = factory.key.build()

      jest
        .spyOn(keysAdapter.KeysApi, 'get')
        .mockResolvedValue({ ok: true, data: key })

      const res = await request(app.callback()).get(`/keys/${key.id}`)

      expect(res.status).toBe(200)
      expect(res.body.content.id).toBe(key.id)
    })

    it('responds with 404 if key not found', async () => {
      jest
        .spyOn(keysAdapter.KeysApi, 'get')
        .mockResolvedValue({ ok: false, err: 'not-found' })

      const res = await request(app.callback()).get(
        '/keys/00000000-0000-0000-0000-000000000999'
      )

      expect(res.status).toBe(404)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.KeysApi, 'get')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get(
        '/keys/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(500)
    })
  })

  describe('POST /keys', () => {
    it('responds with created key on success', async () => {
      const newKey = factory.key.build()

      jest
        .spyOn(keysAdapter.KeysApi, 'create')
        .mockResolvedValue({ ok: true, data: newKey })

      const res = await request(app.callback()).post('/keys').send({
        keyName: newKey.keyName,
        keySequenceNumber: newKey.keySequenceNumber,
        flexNumber: newKey.flexNumber,
        rentalObjectCode: newKey.rentalObjectCode,
        keyType: newKey.keyType,
        keySystemId: newKey.keySystemId,
      })

      expect(res.status).toBe(201)
      expect(res.body.content.id).toBe(newKey.id)
    })

    it('responds with 400 on bad request', async () => {
      jest
        .spyOn(keysAdapter.KeysApi, 'create')
        .mockResolvedValue({ ok: false, err: 'bad-request' })

      const res = await request(app.callback()).post('/keys').send({})

      expect(res.status).toBe(400)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.KeysApi, 'create')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback())
        .post('/keys')
        .send({ keyName: 'Test Key' })

      expect(res.status).toBe(500)
    })
  })

  describe('PATCH /keys/:id', () => {
    it('responds with updated key on success', async () => {
      const updatedKey = factory.key.build()

      jest
        .spyOn(keysAdapter.KeysApi, 'update')
        .mockResolvedValue({ ok: true, data: updatedKey })

      const res = await request(app.callback())
        .patch(`/keys/${updatedKey.id}`)
        .send({ keyName: 'Updated Name' })

      expect(res.status).toBe(200)
      expect(res.body.content.id).toBe(updatedKey.id)
    })

    it('responds with 404 if key not found', async () => {
      jest
        .spyOn(keysAdapter.KeysApi, 'update')
        .mockResolvedValue({ ok: false, err: 'not-found' })

      const res = await request(app.callback())
        .patch('/keys/00000000-0000-0000-0000-000000000999')
        .send({ keyName: 'Updated Name' })

      expect(res.status).toBe(404)
    })

    it('responds with 400 on bad request', async () => {
      jest
        .spyOn(keysAdapter.KeysApi, 'update')
        .mockResolvedValue({ ok: false, err: 'bad-request' })

      const res = await request(app.callback())
        .patch('/keys/00000000-0000-0000-0000-000000000001')
        .send({ invalid: 'data' })

      expect(res.status).toBe(400)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.KeysApi, 'update')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback())
        .patch('/keys/00000000-0000-0000-0000-000000000001')
        .send({ keyName: 'Updated Name' })

      expect(res.status).toBe(500)
    })
  })

  describe('DELETE /keys/:id', () => {
    it('responds with 200 on successful deletion', async () => {
      const key = factory.key.build()

      jest
        .spyOn(keysAdapter.KeysApi, 'get')
        .mockResolvedValue({ ok: true, data: key })

      jest
        .spyOn(keysAdapter.KeysApi, 'remove')
        .mockResolvedValue({ ok: true, data: undefined })

      const res = await request(app.callback()).delete(`/keys/${key.id}`)

      expect(res.status).toBe(200)
    })

    it('responds with 404 if key not found on get', async () => {
      jest
        .spyOn(keysAdapter.KeysApi, 'get')
        .mockResolvedValue({ ok: false, err: 'not-found' })

      const res = await request(app.callback()).delete(
        '/keys/00000000-0000-0000-0000-000000000999'
      )

      expect(res.status).toBe(404)
    })

    it('responds with 500 if adapter fails', async () => {
      const key = factory.key.build()

      jest
        .spyOn(keysAdapter.KeysApi, 'get')
        .mockResolvedValue({ ok: true, data: key })

      jest
        .spyOn(keysAdapter.KeysApi, 'remove')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).delete(`/keys/${key.id}`)

      expect(res.status).toBe(500)
    })
  })

  describe('POST /keys/bulk-update-flex', () => {
    it('responds with updated keys count on success', async () => {
      const result = { updatedCount: 5 }

      jest
        .spyOn(keysAdapter.KeysApi, 'bulkUpdateFlex')
        .mockResolvedValue({ ok: true, data: result })

      const res = await request(app.callback())
        .post('/keys/bulk-update-flex')
        .send({ rentalObjectCode: '123-456-789', flexNumber: 2 })

      expect(res.status).toBe(200)
      expect(res.body.content.updatedCount).toBe(5)
    })

    it('responds with 400 on bad request', async () => {
      jest
        .spyOn(keysAdapter.KeysApi, 'bulkUpdateFlex')
        .mockResolvedValue({ ok: false, err: 'bad-request' })

      const res = await request(app.callback())
        .post('/keys/bulk-update-flex')
        .send({})

      expect(res.status).toBe(400)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.KeysApi, 'bulkUpdateFlex')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback())
        .post('/keys/bulk-update-flex')
        .send({ rentalObjectCode: '123-456-789', flexNumber: 2 })

      expect(res.status).toBe(500)
    })
  })

  // ============================================================================
  // KeyLoans Routes
  // ============================================================================

  describe('GET /key-loans', () => {
    it('responds with key loans on success', async () => {
      const keyLoans = factory.keyLoan.buildList(2)

      jest
        .spyOn(keysAdapter.KeyLoansApi, 'list')
        .mockResolvedValue({ ok: true, data: keyLoans })

      const res = await request(app.callback()).get('/key-loans')

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveLength(2)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.KeyLoansApi, 'list')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get('/key-loans')

      expect(res.status).toBe(500)
    })
  })

  describe('GET /key-loans/search', () => {
    it('responds with search results', async () => {
      const keyLoans = factory.keyLoan.buildList(1)

      jest
        .spyOn(keysAdapter.KeyLoansApi, 'search')
        .mockResolvedValue({ ok: true, data: keyLoans })

      const res = await request(app.callback()).get(
        '/key-loans/search?q=test&fields=contact'
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveLength(1)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.KeyLoansApi, 'search')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get('/key-loans/search?q=test')

      expect(res.status).toBe(500)
    })
  })

  describe('GET /key-loans/by-key/:keyId', () => {
    it('responds with key loans for specific key', async () => {
      const keyLoans = factory.keyLoan.buildList(2)

      jest
        .spyOn(keysAdapter.KeyLoansApi, 'getByKey')
        .mockResolvedValue({ ok: true, data: keyLoans })

      const res = await request(app.callback()).get(
        '/key-loans/by-key/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveLength(2)
    })

    it('responds with 500 if not found', async () => {
      jest
        .spyOn(keysAdapter.KeyLoansApi, 'getByKey')
        .mockResolvedValue({ ok: false, err: 'not-found' })

      const res = await request(app.callback()).get(
        '/key-loans/by-key/00000000-0000-0000-0000-000000000999'
      )

      expect(res.status).toBe(500)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.KeyLoansApi, 'getByKey')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get(
        '/key-loans/by-key/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(500)
    })
  })

  describe('GET /key-loans/:id', () => {
    it('responds with key loan on success', async () => {
      const keyLoan = factory.keyLoan.build()

      jest
        .spyOn(keysAdapter.KeyLoansApi, 'get')
        .mockResolvedValue({ ok: true, data: keyLoan })

      const res = await request(app.callback()).get(`/key-loans/${keyLoan.id}`)

      expect(res.status).toBe(200)
      expect(res.body.content.id).toBe(keyLoan.id)
    })

    it('responds with 404 if key loan not found', async () => {
      jest
        .spyOn(keysAdapter.KeyLoansApi, 'get')
        .mockResolvedValue({ ok: false, err: 'not-found' })

      const res = await request(app.callback()).get(
        '/key-loans/00000000-0000-0000-0000-000000000999'
      )

      expect(res.status).toBe(404)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.KeyLoansApi, 'get')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get(
        '/key-loans/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(500)
    })
  })

  describe('POST /key-loans', () => {
    it('responds with 400 on bad request', async () => {
      jest
        .spyOn(keysAdapter.KeyLoansApi, 'create')
        .mockResolvedValue({ ok: false, err: 'bad-request' })

      const res = await request(app.callback()).post('/key-loans').send({})

      expect(res.status).toBe(400)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.KeyLoansApi, 'create')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback())
        .post('/key-loans')
        .send({ keys: JSON.stringify(['key-1']), contact: 'P123456' })

      expect(res.status).toBe(500)
    })
  })

  describe('PATCH /key-loans/:id', () => {
    it('responds with 404 if key loan not found', async () => {
      jest
        .spyOn(keysAdapter.KeyLoansApi, 'update')
        .mockResolvedValue({ ok: false, err: 'not-found' })

      const res = await request(app.callback())
        .patch('/key-loans/00000000-0000-0000-0000-000000000999')
        .send({ returnedAt: new Date().toISOString() })

      expect(res.status).toBe(404)
    })

    it('responds with 400 on bad request', async () => {
      jest
        .spyOn(keysAdapter.KeyLoansApi, 'update')
        .mockResolvedValue({ ok: false, err: 'bad-request' })

      const res = await request(app.callback())
        .patch('/key-loans/00000000-0000-0000-0000-000000000001')
        .send({ invalid: 'data' })

      expect(res.status).toBe(400)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.KeyLoansApi, 'update')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback())
        .patch('/key-loans/00000000-0000-0000-0000-000000000001')
        .send({ returnedAt: new Date().toISOString() })

      expect(res.status).toBe(500)
    })
  })

  describe('DELETE /key-loans/:id', () => {
    it('responds with 404 if key loan not found on get', async () => {
      jest
        .spyOn(keysAdapter.KeyLoansApi, 'get')
        .mockResolvedValue({ ok: false, err: 'not-found' })

      const res = await request(app.callback()).delete(
        '/key-loans/00000000-0000-0000-0000-000000000999'
      )

      expect(res.status).toBe(404)
    })

    it('responds with 500 if adapter fails', async () => {
      const keyLoan = factory.keyLoan.build()

      jest
        .spyOn(keysAdapter.KeyLoansApi, 'get')
        .mockResolvedValue({ ok: true, data: keyLoan })

      jest
        .spyOn(keysAdapter.KeyLoansApi, 'remove')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).delete(
        `/key-loans/${keyLoan.id}`
      )

      expect(res.status).toBe(500)
    })
  })

  // ============================================================================
  // KeySystems Routes
  // ============================================================================

  describe('GET /key-systems', () => {
    it('responds with paginated key systems on success', async () => {
      const paginatedResponse = {
        content: factory.keySystem.buildList(2),
        _meta: { totalRecords: 2, page: 1, limit: 20, count: 2 },
        _links: [
          { href: '/key-systems?page=1&limit=20', rel: 'self' as const },
          { href: '/key-systems?page=1&limit=20', rel: 'first' as const },
          { href: '/key-systems?page=1&limit=20', rel: 'last' as const },
        ],
      }

      const listSpy = jest
        .spyOn(keysAdapter.KeySystemsApi, 'list')
        .mockResolvedValue({ ok: true, data: paginatedResponse })

      const res = await request(app.callback()).get(
        '/key-systems?page=1&limit=20'
      )

      expect(res.status).toBe(200)
      expect(listSpy).toHaveBeenCalledWith(1, 20)
      expect(res.body.content).toHaveLength(2)
      expect(res.body._meta).toEqual({
        totalRecords: 2,
        page: 1,
        limit: 20,
        count: 2,
      })
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.KeySystemsApi, 'list')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get('/key-systems')

      expect(res.status).toBe(500)
      expect(res.body).toMatchObject({ error: 'Internal server error' })
    })
  })

  describe('GET /key-systems/search', () => {
    it('responds with paginated search results', async () => {
      const paginatedResponse = {
        content: factory.keySystem.buildList(1),
        _meta: { totalRecords: 1, page: 1, limit: 20, count: 1 },
        _links: [
          {
            href: '/key-systems/search?q=test&page=1&limit=20',
            rel: 'self' as const,
          },
          {
            href: '/key-systems/search?q=test&page=1&limit=20',
            rel: 'first' as const,
          },
          {
            href: '/key-systems/search?q=test&page=1&limit=20',
            rel: 'last' as const,
          },
        ],
      }

      const searchSpy = jest
        .spyOn(keysAdapter.KeySystemsApi, 'search')
        .mockResolvedValue({ ok: true, data: paginatedResponse })

      const res = await request(app.callback()).get(
        '/key-systems/search?q=test&fields=systemCode&page=1&limit=20'
      )

      expect(res.status).toBe(200)
      expect(searchSpy).toHaveBeenCalled()
      expect(res.body.content).toHaveLength(1)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.KeySystemsApi, 'search')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get(
        '/key-systems/search?q=test'
      )

      expect(res.status).toBe(500)
    })
  })

  describe('GET /key-systems/:id', () => {
    it('responds with key system on success', async () => {
      const keySystem = factory.keySystem.build()

      jest
        .spyOn(keysAdapter.KeySystemsApi, 'get')
        .mockResolvedValue({ ok: true, data: keySystem })

      const res = await request(app.callback()).get(
        `/key-systems/${keySystem.id}`
      )

      expect(res.status).toBe(200)
      expect(res.body.content.id).toBe(keySystem.id)
    })

    it('responds with 404 if key system not found', async () => {
      jest
        .spyOn(keysAdapter.KeySystemsApi, 'get')
        .mockResolvedValue({ ok: false, err: 'not-found' })

      const res = await request(app.callback()).get(
        '/key-systems/00000000-0000-0000-0000-000000000999'
      )

      expect(res.status).toBe(404)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.KeySystemsApi, 'get')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get(
        '/key-systems/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(500)
    })
  })

  describe('POST /key-systems', () => {
    it('responds with 400 on bad request', async () => {
      jest
        .spyOn(keysAdapter.KeySystemsApi, 'create')
        .mockResolvedValue({ ok: false, err: 'bad-request' })

      const res = await request(app.callback()).post('/key-systems').send({})

      expect(res.status).toBe(400)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.KeySystemsApi, 'create')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback())
        .post('/key-systems')
        .send({ systemCode: 'TEST-001' })

      expect(res.status).toBe(500)
    })
  })

  describe('PATCH /key-systems/:id', () => {
    it('responds with 404 if key system not found', async () => {
      jest
        .spyOn(keysAdapter.KeySystemsApi, 'update')
        .mockResolvedValue({ ok: false, err: 'not-found' })

      const res = await request(app.callback())
        .patch('/key-systems/00000000-0000-0000-0000-000000000999')
        .send({ name: 'Updated Name' })

      expect(res.status).toBe(404)
    })

    it('responds with 400 on bad request', async () => {
      jest
        .spyOn(keysAdapter.KeySystemsApi, 'update')
        .mockResolvedValue({ ok: false, err: 'bad-request' })

      const res = await request(app.callback())
        .patch('/key-systems/00000000-0000-0000-0000-000000000001')
        .send({ invalid: 'data' })

      expect(res.status).toBe(400)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.KeySystemsApi, 'update')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback())
        .patch('/key-systems/00000000-0000-0000-0000-000000000001')
        .send({ name: 'Updated Name' })

      expect(res.status).toBe(500)
    })
  })

  describe('DELETE /key-systems/:id', () => {
    it('responds with 404 if key system not found on get', async () => {
      jest
        .spyOn(keysAdapter.KeySystemsApi, 'get')
        .mockResolvedValue({ ok: false, err: 'not-found' })

      const res = await request(app.callback()).delete(
        '/key-systems/00000000-0000-0000-0000-000000000999'
      )

      expect(res.status).toBe(404)
    })

    it('responds with 500 if adapter fails', async () => {
      const keySystem = factory.keySystem.build()

      jest
        .spyOn(keysAdapter.KeySystemsApi, 'get')
        .mockResolvedValue({ ok: true, data: keySystem })

      jest
        .spyOn(keysAdapter.KeySystemsApi, 'remove')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).delete(
        `/key-systems/${keySystem.id}`
      )

      expect(res.status).toBe(500)
    })
  })

  // ============================================================================
  // Logs Routes
  // ============================================================================

  describe('GET /logs', () => {
    it('responds with paginated logs on success', async () => {
      const paginatedResponse = {
        content: factory.log.buildList(2),
        _meta: { totalRecords: 2, page: 1, limit: 20, count: 2 },
        _links: [
          { href: '/logs?page=1&limit=20', rel: 'self' as const },
          { href: '/logs?page=1&limit=20', rel: 'first' as const },
          { href: '/logs?page=1&limit=20', rel: 'last' as const },
        ],
      }

      const listSpy = jest
        .spyOn(keysAdapter.LogsApi, 'list')
        .mockResolvedValue({ ok: true, data: paginatedResponse })

      const res = await request(app.callback()).get('/logs?page=1&limit=20')

      expect(res.status).toBe(200)
      expect(listSpy).toHaveBeenCalledWith(1, 20)
      expect(res.body.content).toHaveLength(2)
      expect(res.body._meta).toEqual({
        totalRecords: 2,
        page: 1,
        limit: 20,
        count: 2,
      })
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.LogsApi, 'list')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get('/logs')

      expect(res.status).toBe(500)
      expect(res.body).toMatchObject({ error: 'Internal server error' })
    })
  })

  describe('GET /logs/search', () => {
    it('responds with paginated search results', async () => {
      const paginatedResponse = {
        content: factory.log.buildList(1),
        _meta: { totalRecords: 1, page: 1, limit: 20, count: 1 },
        _links: [
          { href: '/logs/search?q=test&page=1&limit=20', rel: 'self' as const },
          {
            href: '/logs/search?q=test&page=1&limit=20',
            rel: 'first' as const,
          },
          { href: '/logs/search?q=test&page=1&limit=20', rel: 'last' as const },
        ],
      }

      const searchSpy = jest
        .spyOn(keysAdapter.LogsApi, 'search')
        .mockResolvedValue({ ok: true, data: paginatedResponse })

      const res = await request(app.callback()).get(
        '/logs/search?q=test&fields=userName&page=1&limit=20'
      )

      expect(res.status).toBe(200)
      expect(searchSpy).toHaveBeenCalled()
      expect(res.body.content).toHaveLength(1)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.LogsApi, 'search')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get('/logs/search?q=test')

      expect(res.status).toBe(500)
    })
  })

  describe('GET /logs/object/:objectId', () => {
    it('responds with logs for specific object', async () => {
      const logs = factory.log.buildList(2)

      jest
        .spyOn(keysAdapter.LogsApi, 'getByObjectId')
        .mockResolvedValue({ ok: true, data: logs })

      const res = await request(app.callback()).get(
        '/logs/object/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveLength(2)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.LogsApi, 'getByObjectId')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get(
        '/logs/object/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(500)
    })
  })

  describe('GET /logs/:id', () => {
    it('responds with log on success', async () => {
      const log = factory.log.build()

      jest
        .spyOn(keysAdapter.LogsApi, 'get')
        .mockResolvedValue({ ok: true, data: log })

      const res = await request(app.callback()).get(`/logs/${log.id}`)

      expect(res.status).toBe(200)
      expect(res.body.content.id).toBe(log.id)
    })

    it('responds with 404 if log not found', async () => {
      jest
        .spyOn(keysAdapter.LogsApi, 'get')
        .mockResolvedValue({ ok: false, err: 'not-found' })

      const res = await request(app.callback()).get(
        '/logs/00000000-0000-0000-0000-000000000999'
      )

      expect(res.status).toBe(404)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.LogsApi, 'get')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get(
        '/logs/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(500)
    })
  })

  describe('POST /logs', () => {
    it('responds with created log on success', async () => {
      const newLog = factory.log.build()

      jest
        .spyOn(keysAdapter.LogsApi, 'create')
        .mockResolvedValue({ ok: true, data: newLog })

      const res = await request(app.callback()).post('/logs').send({
        userName: 'testuser',
        eventType: 'creation',
        objectType: 'key',
        objectId: '00000000-0000-0000-0000-000000000001',
      })

      expect(res.status).toBe(201)
      expect(res.body.content.id).toBe(newLog.id)
    })

    it('responds with 400 on bad request', async () => {
      jest
        .spyOn(keysAdapter.LogsApi, 'create')
        .mockResolvedValue({ ok: false, err: 'bad-request' })

      const res = await request(app.callback()).post('/logs').send({})

      expect(res.status).toBe(400)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.LogsApi, 'create')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback())
        .post('/logs')
        .send({ userName: 'testuser' })

      expect(res.status).toBe(500)
    })
  })

  // ============================================================================
  // KeyNotes Routes
  // ============================================================================

  describe('GET /key-notes/by-rental-object/:rentalObjectCode', () => {
    it('responds with key note for rental object', async () => {
      const keyNote = factory.keyNote.build()

      jest
        .spyOn(keysAdapter.KeyNotesApi, 'getByRentalObjectCode')
        .mockResolvedValue({ ok: true, data: [keyNote] })

      const res = await request(app.callback()).get(
        '/key-notes/by-rental-object/123-456-789'
      )

      expect(res.status).toBe(200)
      expect(res.body.content[0].id).toBe(keyNote.id)
    })

    it('responds with 404 if key note not found', async () => {
      jest
        .spyOn(keysAdapter.KeyNotesApi, 'getByRentalObjectCode')
        .mockResolvedValue({ ok: false, err: 'not-found' })

      const res = await request(app.callback()).get(
        '/key-notes/by-rental-object/999-999-999'
      )

      expect(res.status).toBe(404)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.KeyNotesApi, 'getByRentalObjectCode')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get(
        '/key-notes/by-rental-object/123-456-789'
      )

      expect(res.status).toBe(500)
    })
  })

  describe('GET /key-notes/:id', () => {
    it('responds with key note on success', async () => {
      const keyNote = factory.keyNote.build()

      jest
        .spyOn(keysAdapter.KeyNotesApi, 'get')
        .mockResolvedValue({ ok: true, data: keyNote })

      const res = await request(app.callback()).get(`/key-notes/${keyNote.id}`)

      expect(res.status).toBe(200)
      expect(res.body.content.id).toBe(keyNote.id)
    })

    it('responds with 404 if key note not found', async () => {
      jest
        .spyOn(keysAdapter.KeyNotesApi, 'get')
        .mockResolvedValue({ ok: false, err: 'not-found' })

      const res = await request(app.callback()).get(
        '/key-notes/00000000-0000-0000-0000-000000000999'
      )

      expect(res.status).toBe(404)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.KeyNotesApi, 'get')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get(
        '/key-notes/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(500)
    })
  })

  describe('POST /key-notes', () => {
    it('responds with 400 on bad request', async () => {
      jest
        .spyOn(keysAdapter.KeyNotesApi, 'create')
        .mockResolvedValue({ ok: false, err: 'bad-request' })

      const res = await request(app.callback()).post('/key-notes').send({})

      expect(res.status).toBe(400)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.KeyNotesApi, 'create')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).post('/key-notes').send({
        rentalObjectCode: '123-456-789',
        description: 'Test note',
      })

      expect(res.status).toBe(500)
    })
  })

  describe('PATCH /key-notes/:id', () => {
    it('responds with 404 if key note not found', async () => {
      jest
        .spyOn(keysAdapter.KeyNotesApi, 'update')
        .mockResolvedValue({ ok: false, err: 'not-found' })

      const res = await request(app.callback())
        .patch('/key-notes/00000000-0000-0000-0000-000000000999')
        .send({ description: 'Updated' })

      expect(res.status).toBe(404)
    })

    it('responds with 400 on bad request', async () => {
      jest
        .spyOn(keysAdapter.KeyNotesApi, 'update')
        .mockResolvedValue({ ok: false, err: 'bad-request' })

      const res = await request(app.callback())
        .patch('/key-notes/00000000-0000-0000-0000-000000000001')
        .send({ invalid: 'data' })

      expect(res.status).toBe(400)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.KeyNotesApi, 'update')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback())
        .patch('/key-notes/00000000-0000-0000-0000-000000000001')
        .send({ description: 'Updated' })

      expect(res.status).toBe(500)
    })
  })

  // ============================================================================
  // Receipts Routes
  // ============================================================================

  describe('POST /receipts', () => {
    it('responds with 400 on bad request', async () => {
      jest
        .spyOn(keysAdapter.ReceiptsApi, 'create')
        .mockResolvedValue({ ok: false, err: 'bad-request' })

      const res = await request(app.callback()).post('/receipts').send({})

      expect(res.status).toBe(400)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.ReceiptsApi, 'create')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).post('/receipts').send({
        keyLoanId: '00000000-0000-0000-0000-000000000001',
        receiptType: 'LOAN',
      })

      expect(res.status).toBe(500)
    })
  })

  describe('GET /receipts/:id', () => {
    it('responds with receipt on success', async () => {
      const receipt = factory.receipt.build()

      jest
        .spyOn(keysAdapter.ReceiptsApi, 'get')
        .mockResolvedValue({ ok: true, data: receipt })

      const res = await request(app.callback()).get(`/receipts/${receipt.id}`)

      expect(res.status).toBe(200)
      expect(res.body.content.id).toBe(receipt.id)
    })

    it('responds with 404 if receipt not found', async () => {
      jest
        .spyOn(keysAdapter.ReceiptsApi, 'get')
        .mockResolvedValue({ ok: false, err: 'not-found' })

      const res = await request(app.callback()).get(
        '/receipts/00000000-0000-0000-0000-000000000999'
      )

      expect(res.status).toBe(404)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.ReceiptsApi, 'get')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get(
        '/receipts/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(500)
    })
  })

  describe('GET /receipts/by-key-loan/:keyLoanId', () => {
    it('responds with receipts for key loan', async () => {
      const receipts = factory.receipt.buildList(2)

      jest
        .spyOn(keysAdapter.ReceiptsApi, 'getByKeyLoan')
        .mockResolvedValue({ ok: true, data: receipts })

      const res = await request(app.callback()).get(
        '/receipts/by-key-loan/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveLength(2)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.ReceiptsApi, 'getByKeyLoan')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get(
        '/receipts/by-key-loan/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(500)
    })
  })

  describe('PATCH /receipts/:id', () => {
    it('responds with 404 if receipt not found', async () => {
      jest
        .spyOn(keysAdapter.ReceiptsApi, 'update')
        .mockResolvedValue({ ok: false, err: 'not-found' })

      const res = await request(app.callback())
        .patch('/receipts/00000000-0000-0000-0000-000000000999')
        .send({ receiptType: 'RETURN' })

      expect(res.status).toBe(404)
    })

    it('responds with 400 on bad request', async () => {
      jest
        .spyOn(keysAdapter.ReceiptsApi, 'update')
        .mockResolvedValue({ ok: false, err: 'bad-request' })

      const res = await request(app.callback())
        .patch('/receipts/00000000-0000-0000-0000-000000000001')
        .send({ invalid: 'data' })

      expect(res.status).toBe(400)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.ReceiptsApi, 'update')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback())
        .patch('/receipts/00000000-0000-0000-0000-000000000001')
        .send({ receiptType: 'RETURN' })

      expect(res.status).toBe(500)
    })
  })

  describe('DELETE /receipts/:id', () => {
    it('responds with 404 if receipt not found on get', async () => {
      jest
        .spyOn(keysAdapter.ReceiptsApi, 'remove')
        .mockResolvedValue({ ok: false, err: 'not-found' })

      const res = await request(app.callback()).delete(
        '/receipts/00000000-0000-0000-0000-000000000999'
      )

      expect(res.status).toBe(404)
    })

    it('responds with 500 if adapter fails', async () => {
      const receipt = factory.receipt.build()

      jest
        .spyOn(keysAdapter.ReceiptsApi, 'get')
        .mockResolvedValue({ ok: true, data: receipt })

      jest
        .spyOn(keysAdapter.ReceiptsApi, 'remove')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).delete(
        `/receipts/${receipt.id}`
      )

      expect(res.status).toBe(500)
    })
  })

  describe('POST /receipts/:id/upload-base64', () => {
    it('responds with 404 if receipt not found', async () => {
      jest
        .spyOn(keysAdapter.ReceiptsApi, 'uploadFileBase64')
        .mockResolvedValue({ ok: false, err: 'not-found' })

      const res = await request(app.callback())
        .post('/receipts/00000000-0000-0000-0000-000000000999/upload-base64')
        .send({ fileContent: 'base64data' })

      expect(res.status).toBe(404)
    })

    it('responds with 400 on bad request', async () => {
      jest
        .spyOn(keysAdapter.ReceiptsApi, 'uploadFileBase64')
        .mockResolvedValue({ ok: false, err: 'bad-request' })

      const res = await request(app.callback())
        .post('/receipts/00000000-0000-0000-0000-000000000001/upload-base64')
        .send({})

      expect(res.status).toBe(400)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.ReceiptsApi, 'uploadFileBase64')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback())
        .post('/receipts/00000000-0000-0000-0000-000000000001/upload-base64')
        .send({ fileContent: 'base64data' })

      expect(res.status).toBe(500)
    })
  })

  describe('GET /receipts/:id/download', () => {
    it('responds with download URL on success', async () => {
      const downloadInfo = {
        url: 'https://example.com/file.pdf',
        expiresIn: 3600,
        fileId: 'file-123',
      }

      jest
        .spyOn(keysAdapter.ReceiptsApi, 'getDownloadUrl')
        .mockResolvedValue({ ok: true, data: downloadInfo })

      const res = await request(app.callback()).get(
        '/receipts/00000000-0000-0000-0000-000000000001/download'
      )

      expect(res.status).toBe(200)
      expect(res.body.content.url).toBe(downloadInfo.url)
    })

    it('responds with 404 if receipt not found', async () => {
      jest
        .spyOn(keysAdapter.ReceiptsApi, 'getDownloadUrl')
        .mockResolvedValue({ ok: false, err: 'not-found' })

      const res = await request(app.callback()).get(
        '/receipts/00000000-0000-0000-0000-000000000999/download'
      )

      expect(res.status).toBe(404)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.ReceiptsApi, 'getDownloadUrl')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get(
        '/receipts/00000000-0000-0000-0000-000000000001/download'
      )

      expect(res.status).toBe(500)
    })
  })

  // ============================================================================
  // KeyEvents Routes
  // ============================================================================

  describe('GET /key-events', () => {
    it('responds with key events on success', async () => {
      const keyEvents = factory.keyEvent.buildList(2)

      jest
        .spyOn(keysAdapter.KeyEventsApi, 'list')
        .mockResolvedValue({ ok: true, data: keyEvents })

      const res = await request(app.callback()).get('/key-events')

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveLength(2)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.KeyEventsApi, 'list')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get('/key-events')

      expect(res.status).toBe(500)
    })
  })

  describe('GET /key-events/by-key/:keyId', () => {
    it('responds with key events for specific key', async () => {
      const keyEvents = factory.keyEvent.buildList(2)

      jest
        .spyOn(keysAdapter.KeyEventsApi, 'getByKey')
        .mockResolvedValue({ ok: true, data: keyEvents })

      const res = await request(app.callback()).get(
        '/key-events/by-key/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveLength(2)
    })

    it('responds with key events with limit parameter', async () => {
      const keyEvents = factory.keyEvent.buildList(5)

      const getByKeySpy = jest
        .spyOn(keysAdapter.KeyEventsApi, 'getByKey')
        .mockResolvedValue({ ok: true, data: keyEvents })

      const res = await request(app.callback()).get(
        '/key-events/by-key/00000000-0000-0000-0000-000000000001?limit=5'
      )

      expect(res.status).toBe(200)
      expect(getByKeySpy).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000001',
        5
      )
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.KeyEventsApi, 'getByKey')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get(
        '/key-events/by-key/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(500)
    })
  })

  describe('GET /key-events/:id', () => {
    it('responds with key event on success', async () => {
      const keyEvent = factory.keyEvent.build()

      jest
        .spyOn(keysAdapter.KeyEventsApi, 'get')
        .mockResolvedValue({ ok: true, data: keyEvent })

      const res = await request(app.callback()).get(
        `/key-events/${keyEvent.id}`
      )

      expect(res.status).toBe(200)
      expect(res.body.content.id).toBe(keyEvent.id)
    })

    it('responds with 404 if key event not found', async () => {
      jest
        .spyOn(keysAdapter.KeyEventsApi, 'get')
        .mockResolvedValue({ ok: false, err: 'not-found' })

      const res = await request(app.callback()).get(
        '/key-events/00000000-0000-0000-0000-000000000999'
      )

      expect(res.status).toBe(404)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.KeyEventsApi, 'get')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get(
        '/key-events/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(500)
    })
  })

  describe('POST /key-events', () => {
    it('responds with 400 on bad request', async () => {
      jest
        .spyOn(keysAdapter.KeyEventsApi, 'create')
        .mockResolvedValue({ ok: false, err: 'bad-request' })

      const res = await request(app.callback()).post('/key-events').send({})

      expect(res.status).toBe(400)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.KeyEventsApi, 'create')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback())
        .post('/key-events')
        .send({
          keys: JSON.stringify(['key-1']),
          type: 'FLEX',
        })

      expect(res.status).toBe(500)
    })
  })

  describe('PATCH /key-events/:id', () => {
    it('responds with 404 if key event not found', async () => {
      jest
        .spyOn(keysAdapter.KeyEventsApi, 'update')
        .mockResolvedValue({ ok: false, err: 'not-found' })

      const res = await request(app.callback())
        .patch('/key-events/00000000-0000-0000-0000-000000000999')
        .send({ status: 'COMPLETED' })

      expect(res.status).toBe(404)
    })

    it('responds with 400 on bad request', async () => {
      jest
        .spyOn(keysAdapter.KeyEventsApi, 'update')
        .mockResolvedValue({ ok: false, err: 'bad-request' })

      const res = await request(app.callback())
        .patch('/key-events/00000000-0000-0000-0000-000000000001')
        .send({ invalid: 'data' })

      expect(res.status).toBe(400)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.KeyEventsApi, 'update')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback())
        .patch('/key-events/00000000-0000-0000-0000-000000000001')
        .send({ status: 'COMPLETED' })

      expect(res.status).toBe(500)
    })
  })
})
