import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes } from '../index'
import * as keysAdapter from '../../../adapters/keys-adapter'
import * as fileStorageAdapter from '../../../adapters/file-storage-adapter'
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
      expect(listSpy).toHaveBeenCalledWith({ page: '1', limit: '20' })
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
        .put(`/keys/${updatedKey.id}`)
        .send({ keyName: 'Updated Name' })

      expect(res.status).toBe(200)
      expect(res.body.content.id).toBe(updatedKey.id)
    })

    it('responds with 404 if key not found', async () => {
      jest
        .spyOn(keysAdapter.KeysApi, 'update')
        .mockResolvedValue({ ok: false, err: 'not-found' })

      const res = await request(app.callback())
        .put('/keys/00000000-0000-0000-0000-000000000999')
        .send({ keyName: 'Updated Name' })

      expect(res.status).toBe(404)
    })

    it('responds with 400 on bad request', async () => {
      jest
        .spyOn(keysAdapter.KeysApi, 'update')
        .mockResolvedValue({ ok: false, err: 'bad-request' })

      const res = await request(app.callback())
        .put('/keys/00000000-0000-0000-0000-000000000001')
        .send({ invalid: 'data' })

      expect(res.status).toBe(400)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.KeysApi, 'update')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback())
        .put('/keys/00000000-0000-0000-0000-000000000001')
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
      jest
        .spyOn(keysAdapter.KeysApi, 'bulkUpdateFlex')
        .mockResolvedValue({ ok: true, data: 5 })

      const res = await request(app.callback())
        .post('/keys/bulk-update-flex')
        .send({ rentalObjectCode: '123-456-789', flexNumber: 2 })

      expect(res.status).toBe(200)
      expect(res.body.content).toBe(5)
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

      jest.spyOn(keysAdapter.KeyLoansApi, 'search').mockResolvedValue({
        ok: true,
        data: {
          content: keyLoans,
          _meta: { totalRecords: 1, page: 1, limit: 10, count: 1 },
          _links: [
            { href: '/key-loans/search?q=test&fields=contact', rel: 'self' },
          ],
        },
      })

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
    it('responds with created key loan on success', async () => {
      const newKeyLoan = factory.keyLoan.build()

      jest
        .spyOn(keysAdapter.KeyLoansApi, 'create')
        .mockResolvedValue({ ok: true, data: newKeyLoan })

      const res = await request(app.callback())
        .post('/key-loans')
        .send({
          keys: JSON.stringify(['key-1', 'key-2']),
          contact: 'P123456',
          lease: 'lease-123',
        })

      expect(res.status).toBe(201)
      expect(res.body.content.id).toBe(newKeyLoan.id)
    })

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
    it('responds with updated key loan on success', async () => {
      const updatedKeyLoan = factory.keyLoan.build()

      jest
        .spyOn(keysAdapter.KeyLoansApi, 'update')
        .mockResolvedValue({ ok: true, data: updatedKeyLoan })

      const res = await request(app.callback())
        .put(`/key-loans/${updatedKeyLoan.id}`)
        .send({ returnedAt: new Date().toISOString() })

      expect(res.status).toBe(200)
      expect(res.body.content.id).toBe(updatedKeyLoan.id)
    })

    it('responds with 404 if key loan not found', async () => {
      jest
        .spyOn(keysAdapter.KeyLoansApi, 'update')
        .mockResolvedValue({ ok: false, err: 'not-found' })

      const res = await request(app.callback())
        .put('/key-loans/00000000-0000-0000-0000-000000000999')
        .send({ returnedAt: new Date().toISOString() })

      expect(res.status).toBe(404)
    })

    it('responds with 400 on bad request', async () => {
      jest
        .spyOn(keysAdapter.KeyLoansApi, 'update')
        .mockResolvedValue({ ok: false, err: 'bad-request' })

      const res = await request(app.callback())
        .put('/key-loans/00000000-0000-0000-0000-000000000001')
        .send({ invalid: 'data' })

      expect(res.status).toBe(400)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.KeyLoansApi, 'update')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback())
        .put('/key-loans/00000000-0000-0000-0000-000000000001')
        .send({ returnedAt: new Date().toISOString() })

      expect(res.status).toBe(500)
    })
  })

  describe('DELETE /key-loans/:id', () => {
    it('responds with 200 on successful deletion', async () => {
      const keyLoan = factory.keyLoan.build()

      jest
        .spyOn(keysAdapter.KeyLoansApi, 'get')
        .mockResolvedValue({ ok: true, data: keyLoan })

      jest
        .spyOn(keysAdapter.KeyLoansApi, 'remove')
        .mockResolvedValue({ ok: true, data: undefined })

      const res = await request(app.callback()).delete(
        `/key-loans/${keyLoan.id}`
      )

      expect(res.status).toBe(200)
    })

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

  describe('GET /key-loans/by-rental-object/:rentalObjectCode', () => {
    it('responds with key loans for rental object on success', async () => {
      const keyLoans = factory.keyLoanWithDetails.buildList(2)

      jest
        .spyOn(keysAdapter.KeyLoansApi, 'getByRentalObject')
        .mockResolvedValue({ ok: true, data: keyLoans })

      const res = await request(app.callback()).get(
        '/key-loans/by-rental-object/123-456-789'
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveLength(2)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.KeyLoansApi, 'getByRentalObject')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get(
        '/key-loans/by-rental-object/123-456-789'
      )

      expect(res.status).toBe(500)
    })
  })

  describe('GET /key-loans/by-contact/:contact/with-keys', () => {
    it('responds with key loans with keys for contact on success', async () => {
      const keyLoansWithKeys = factory.keyLoanWithDetails.buildList(2)

      jest
        .spyOn(keysAdapter.KeyLoansApi, 'getByContactWithKeys')
        .mockResolvedValue({ ok: true, data: keyLoansWithKeys })

      const res = await request(app.callback()).get(
        '/key-loans/by-contact/P123456/with-keys'
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveLength(2)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.KeyLoansApi, 'getByContactWithKeys')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get(
        '/key-loans/by-contact/P123456/with-keys'
      )

      expect(res.status).toBe(500)
    })
  })

  describe('GET /key-loans/by-bundle/:bundleId/with-keys', () => {
    it('responds with key loans with keys for bundle on success', async () => {
      const keyLoansWithKeys = factory.keyLoanWithDetails.buildList(1)

      jest
        .spyOn(keysAdapter.KeyLoansApi, 'getByBundleWithKeys')
        .mockResolvedValue({ ok: true, data: keyLoansWithKeys })

      const res = await request(app.callback()).get(
        '/key-loans/by-bundle/bundle-123/with-keys'
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveLength(1)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.KeyLoansApi, 'getByBundleWithKeys')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get(
        '/key-loans/by-bundle/bundle-123/with-keys'
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
      expect(listSpy).toHaveBeenCalledWith({ page: '1', limit: '20' })
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
    it('responds with created key system on success', async () => {
      const newKeySystem = factory.keySystem.build()

      jest
        .spyOn(keysAdapter.KeySystemsApi, 'create')
        .mockResolvedValue({ ok: true, data: newKeySystem })

      const res = await request(app.callback())
        .post('/key-systems')
        .send({ systemCode: 'TEST-001', name: 'Test System' })

      expect(res.status).toBe(201)
      expect(res.body.content.id).toBe(newKeySystem.id)
    })

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
    it('responds with updated key system on success', async () => {
      const updatedKeySystem = factory.keySystem.build()

      jest
        .spyOn(keysAdapter.KeySystemsApi, 'update')
        .mockResolvedValue({ ok: true, data: updatedKeySystem })

      const res = await request(app.callback())
        .put(`/key-systems/${updatedKeySystem.id}`)
        .send({ name: 'Updated Name' })

      expect(res.status).toBe(200)
      expect(res.body.content.id).toBe(updatedKeySystem.id)
    })

    it('responds with 404 if key system not found', async () => {
      jest
        .spyOn(keysAdapter.KeySystemsApi, 'update')
        .mockResolvedValue({ ok: false, err: 'not-found' })

      const res = await request(app.callback())
        .put('/key-systems/00000000-0000-0000-0000-000000000999')
        .send({ name: 'Updated Name' })

      expect(res.status).toBe(404)
    })

    it('responds with 400 on bad request', async () => {
      jest
        .spyOn(keysAdapter.KeySystemsApi, 'update')
        .mockResolvedValue({ ok: false, err: 'bad-request' })

      const res = await request(app.callback())
        .put('/key-systems/00000000-0000-0000-0000-000000000001')
        .send({ invalid: 'data' })

      expect(res.status).toBe(400)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.KeySystemsApi, 'update')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback())
        .put('/key-systems/00000000-0000-0000-0000-000000000001')
        .send({ name: 'Updated Name' })

      expect(res.status).toBe(500)
    })
  })

  describe('DELETE /key-systems/:id', () => {
    it('responds with 200 on successful deletion', async () => {
      const keySystem = factory.keySystem.build()

      jest
        .spyOn(keysAdapter.KeySystemsApi, 'get')
        .mockResolvedValue({ ok: true, data: keySystem })

      jest
        .spyOn(keysAdapter.KeySystemsApi, 'remove')
        .mockResolvedValue({ ok: true, data: undefined })

      const res = await request(app.callback()).delete(
        `/key-systems/${keySystem.id}`
      )

      expect(res.status).toBe(200)
    })

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

  describe('GET /key-systems/:id/download-schema', () => {
    it('responds with download URL on success', async () => {
      const keySystem = factory.keySystem.build({
        schemaFileId: 'schemas/key-system-123.pdf',
      })
      const mockUrl = {
        url: 'https://minio.example.com/schemas/file.json',
        expiresIn: 3600,
      }

      jest
        .spyOn(keysAdapter.KeySystemsApi, 'get')
        .mockResolvedValue({ ok: true, data: keySystem })

      jest.spyOn(fileStorageAdapter, 'getFileUrl').mockResolvedValue({
        ok: true,
        data: mockUrl,
      })

      const res = await request(app.callback()).get(
        '/key-systems/system-123/download-schema'
      )

      expect(res.status).toBe(200)
      expect(res.body.content.url).toBe(mockUrl.url)
    })

    it('responds with 404 if key system not found', async () => {
      jest
        .spyOn(keysAdapter.KeySystemsApi, 'get')
        .mockResolvedValue({ ok: false, err: 'not-found' })

      const res = await request(app.callback()).get(
        '/key-systems/system-123/download-schema'
      )

      expect(res.status).toBe(404)
    })

    it('responds with 500 if file storage fails', async () => {
      const keySystem = factory.keySystem.build({
        schemaFileId: 'schemas/key-system-123.pdf',
      })

      jest
        .spyOn(keysAdapter.KeySystemsApi, 'get')
        .mockResolvedValue({ ok: true, data: keySystem })

      jest.spyOn(fileStorageAdapter, 'getFileUrl').mockResolvedValue({
        ok: false,
        err: 'unknown',
      })

      const res = await request(app.callback()).get(
        '/key-systems/system-123/download-schema'
      )

      expect(res.status).toBe(500)
    })
  })

  describe('DELETE /key-systems/:id/schema', () => {
    it('responds with 204 on successful schema deletion', async () => {
      const keySystem = factory.keySystem.build({
        schemaFileId: 'schemas/key-system-123.pdf',
      })

      jest
        .spyOn(keysAdapter.KeySystemsApi, 'get')
        .mockResolvedValue({ ok: true, data: keySystem })

      jest.spyOn(fileStorageAdapter, 'deleteFile').mockResolvedValue({
        ok: true,
        data: undefined,
      })

      jest.spyOn(keysAdapter.KeySystemsApi, 'update').mockResolvedValue({
        ok: true,
        data: { ...keySystem, schemaFileId: null },
      })

      const res = await request(app.callback()).delete(
        '/key-systems/system-123/schema'
      )

      expect(res.status).toBe(204)
    })

    it('responds with 404 if key system not found', async () => {
      jest
        .spyOn(keysAdapter.KeySystemsApi, 'get')
        .mockResolvedValue({ ok: false, err: 'not-found' })

      const res = await request(app.callback()).delete(
        '/key-systems/system-123/schema'
      )

      expect(res.status).toBe(404)
    })

    it('responds with 500 if file storage deletion fails', async () => {
      const keySystem = factory.keySystem.build({
        schemaFileId: 'schemas/key-system-123.pdf',
      })

      jest
        .spyOn(keysAdapter.KeySystemsApi, 'get')
        .mockResolvedValue({ ok: true, data: keySystem })

      jest.spyOn(fileStorageAdapter, 'deleteFile').mockResolvedValue({
        ok: false,
        err: 'unknown',
      })

      const res = await request(app.callback()).delete(
        '/key-systems/system-123/schema'
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
      expect(listSpy).toHaveBeenCalledWith({ page: '1', limit: '20' })
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

  describe('GET /logs/rental-object/:rentalObjectCode', () => {
    it('responds with paginated logs for rental object on success', async () => {
      const paginatedResponse = {
        content: factory.log.buildList(3),
        _meta: { totalRecords: 3, page: 1, limit: 20, count: 3 },
        _links: [
          {
            href: '/logs/rental-object/123-456-789?page=1&limit=20',
            rel: 'self' as const,
          },
          {
            href: '/logs/rental-object/123-456-789?page=1&limit=20',
            rel: 'first' as const,
          },
          {
            href: '/logs/rental-object/123-456-789?page=1&limit=20',
            rel: 'last' as const,
          },
        ],
      }

      jest
        .spyOn(keysAdapter.LogsApi, 'getByRentalObjectCode')
        .mockResolvedValue({ ok: true, data: paginatedResponse })

      const res = await request(app.callback()).get(
        '/logs/rental-object/123-456-789'
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveLength(3)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.LogsApi, 'getByRentalObjectCode')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get(
        '/logs/rental-object/123-456-789'
      )

      expect(res.status).toBe(500)
    })
  })

  describe('GET /logs/contact/:contactId', () => {
    it('responds with paginated logs for contact on success', async () => {
      const paginatedResponse = {
        content: factory.log.buildList(2),
        _meta: { totalRecords: 2, page: 1, limit: 20, count: 2 },
        _links: [
          {
            href: '/logs/contact/P123456?page=1&limit=20',
            rel: 'self' as const,
          },
          {
            href: '/logs/contact/P123456?page=1&limit=20',
            rel: 'first' as const,
          },
          {
            href: '/logs/contact/P123456?page=1&limit=20',
            rel: 'last' as const,
          },
        ],
      }

      jest
        .spyOn(keysAdapter.LogsApi, 'getByContactId')
        .mockResolvedValue({ ok: true, data: paginatedResponse })

      const res = await request(app.callback()).get('/logs/contact/P123456')

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveLength(2)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.LogsApi, 'getByContactId')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get('/logs/contact/P123456')

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
    it('responds with created key note on success', async () => {
      const newKeyNote = factory.keyNote.build()

      jest
        .spyOn(keysAdapter.KeyNotesApi, 'create')
        .mockResolvedValue({ ok: true, data: newKeyNote })

      const res = await request(app.callback()).post('/key-notes').send({
        rentalObjectCode: '123-456-789',
        description: 'Test note',
      })

      expect(res.status).toBe(201)
      expect(res.body.content.id).toBe(newKeyNote.id)
    })

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
    it('responds with updated key note on success', async () => {
      const updatedKeyNote = factory.keyNote.build()

      jest
        .spyOn(keysAdapter.KeyNotesApi, 'update')
        .mockResolvedValue({ ok: true, data: updatedKeyNote })

      const res = await request(app.callback())
        .put(`/key-notes/${updatedKeyNote.id}`)
        .send({ description: 'Updated' })

      expect(res.status).toBe(200)
      expect(res.body.content.id).toBe(updatedKeyNote.id)
    })

    it('responds with 404 if key note not found', async () => {
      jest
        .spyOn(keysAdapter.KeyNotesApi, 'update')
        .mockResolvedValue({ ok: false, err: 'not-found' })

      const res = await request(app.callback())
        .put('/key-notes/00000000-0000-0000-0000-000000000999')
        .send({ description: 'Updated' })

      expect(res.status).toBe(404)
    })

    it('responds with 400 on bad request', async () => {
      jest
        .spyOn(keysAdapter.KeyNotesApi, 'update')
        .mockResolvedValue({ ok: false, err: 'bad-request' })

      const res = await request(app.callback())
        .put('/key-notes/00000000-0000-0000-0000-000000000001')
        .send({ invalid: 'data' })

      expect(res.status).toBe(400)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.KeyNotesApi, 'update')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback())
        .put('/key-notes/00000000-0000-0000-0000-000000000001')
        .send({ description: 'Updated' })

      expect(res.status).toBe(500)
    })
  })

  // ============================================================================
  // Receipts Routes
  // ============================================================================

  describe('POST /receipts', () => {
    it('responds with created receipt on success', async () => {
      const newReceipt = factory.receipt.build()

      jest
        .spyOn(keysAdapter.ReceiptsApi, 'create')
        .mockResolvedValue({ ok: true, data: newReceipt })

      const res = await request(app.callback()).post('/receipts').send({
        keyLoanId: '00000000-0000-0000-0000-000000000001',
        receiptType: 'LOAN',
      })

      expect(res.status).toBe(201)
      expect(res.body.content.id).toBe(newReceipt.id)
    })

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
    it('responds with updated receipt on success', async () => {
      const updatedReceipt = factory.receipt.build()

      jest
        .spyOn(keysAdapter.ReceiptsApi, 'update')
        .mockResolvedValue({ ok: true, data: updatedReceipt })

      const res = await request(app.callback())
        .put(`/receipts/${updatedReceipt.id}`)
        .send({ receiptType: 'RETURN' })

      expect(res.status).toBe(200)
      expect(res.body.content.id).toBe(updatedReceipt.id)
    })

    it('responds with 404 if receipt not found', async () => {
      jest
        .spyOn(keysAdapter.ReceiptsApi, 'update')
        .mockResolvedValue({ ok: false, err: 'not-found' })

      const res = await request(app.callback())
        .put('/receipts/00000000-0000-0000-0000-000000000999')
        .send({ receiptType: 'RETURN' })

      expect(res.status).toBe(404)
    })

    it('responds with 400 on bad request', async () => {
      jest
        .spyOn(keysAdapter.ReceiptsApi, 'update')
        .mockResolvedValue({ ok: false, err: 'bad-request' })

      const res = await request(app.callback())
        .put('/receipts/00000000-0000-0000-0000-000000000001')
        .send({ invalid: 'data' })

      expect(res.status).toBe(400)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.ReceiptsApi, 'update')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback())
        .put('/receipts/00000000-0000-0000-0000-000000000001')
        .send({ receiptType: 'RETURN' })

      expect(res.status).toBe(500)
    })
  })

  describe('DELETE /receipts/:id', () => {
    it('responds with 200 on successful deletion', async () => {
      const receipt = factory.receipt.build({ fileId: null })

      jest
        .spyOn(keysAdapter.ReceiptsApi, 'get')
        .mockResolvedValue({ ok: true, data: receipt })

      jest
        .spyOn(keysAdapter.ReceiptsApi, 'remove')
        .mockResolvedValue({ ok: true, data: undefined })

      const res = await request(app.callback()).delete(
        `/receipts/${receipt.id}`
      )

      expect(res.status).toBe(200)
    })

    it('responds with 404 if receipt not found on get', async () => {
      jest
        .spyOn(keysAdapter.ReceiptsApi, 'get')
        .mockResolvedValue({ ok: false, err: 'not-found' })

      jest
        .spyOn(keysAdapter.ReceiptsApi, 'remove')
        .mockResolvedValue({ ok: false, err: 'not-found' })

      const res = await request(app.callback()).delete(
        '/receipts/00000000-0000-0000-0000-000000000999'
      )

      expect(res.status).toBe(404)
    })

    it('responds with 500 if adapter fails', async () => {
      const receipt = factory.receipt.build({ fileId: null })

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

  describe('GET /receipts/:id/download', () => {
    it('responds with download URL on success', async () => {
      const receipt = factory.receipt.build({
        fileId: 'keys/receipt-123.pdf',
      })

      jest
        .spyOn(keysAdapter.ReceiptsApi, 'get')
        .mockResolvedValue({ ok: true, data: receipt })

      jest.spyOn(fileStorageAdapter, 'getFileUrl').mockResolvedValue({
        ok: true,
        data: { url: 'https://example.com/file.pdf', expiresIn: 3600 },
      })

      const res = await request(app.callback()).get(
        '/receipts/00000000-0000-0000-0000-000000000001/download'
      )

      expect(res.status).toBe(200)
      expect(res.body.content.url).toBe('https://example.com/file.pdf')
      expect(res.body.content.fileId).toBe('keys/receipt-123.pdf')
    })

    it('responds with 404 if receipt not found', async () => {
      jest
        .spyOn(keysAdapter.ReceiptsApi, 'get')
        .mockResolvedValue({ ok: false, err: 'not-found' })

      const res = await request(app.callback()).get(
        '/receipts/00000000-0000-0000-0000-000000000999/download'
      )

      expect(res.status).toBe(404)
    })

    it('responds with 500 if file storage fails', async () => {
      const receipt = factory.receipt.build({
        fileId: 'keys/receipt-123.pdf',
      })

      jest
        .spyOn(keysAdapter.ReceiptsApi, 'get')
        .mockResolvedValue({ ok: true, data: receipt })

      jest.spyOn(fileStorageAdapter, 'getFileUrl').mockResolvedValue({
        ok: false,
        err: 'unknown',
      })

      const res = await request(app.callback()).get(
        '/receipts/00000000-0000-0000-0000-000000000001/download'
      )

      expect(res.status).toBe(500)
    })
  })

  describe('POST /receipts/:id/upload', () => {
    it('uploads file successfully and returns fileId', async () => {
      const receipt = factory.receipt.build({ fileId: null })
      const updatedReceipt = factory.receipt.build({
        fileId: 'keys/receipt-123.pdf',
      })

      jest
        .spyOn(keysAdapter.ReceiptsApi, 'get')
        .mockResolvedValue({ ok: true, data: receipt })

      jest.spyOn(fileStorageAdapter, 'uploadFile').mockResolvedValue({
        ok: true,
        data: { fileName: 'keys/receipt-123.pdf', message: 'uploaded' },
      })

      jest
        .spyOn(keysAdapter.ReceiptsApi, 'update')
        .mockResolvedValue({ ok: true, data: updatedReceipt })

      jest
        .spyOn(keysAdapter.KeyLoansApi, 'activate')
        .mockResolvedValue({ ok: true, data: undefined as any })

      const res = await request(app.callback())
        .post('/receipts/00000000-0000-0000-0000-000000000001/upload')
        .send({
          fileData: Buffer.from('test pdf').toString('base64'),
          fileContentType: 'application/pdf',
        })

      expect(res.status).toBe(200)
      expect(res.body.content.fileId).toBe('keys/receipt-123.pdf')
    })

    it('responds with 400 if fileData is missing', async () => {
      const res = await request(app.callback())
        .post('/receipts/00000000-0000-0000-0000-000000000001/upload')
        .send({})

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('Missing fileData')
    })

    it('responds with 404 if receipt not found', async () => {
      jest
        .spyOn(keysAdapter.ReceiptsApi, 'get')
        .mockResolvedValue({ ok: false, err: 'not-found' })

      const res = await request(app.callback())
        .post('/receipts/00000000-0000-0000-0000-000000000999/upload')
        .send({ fileData: 'base64data' })

      expect(res.status).toBe(404)
    })

    it('responds with 500 if upload fails', async () => {
      const receipt = factory.receipt.build({ fileId: null })

      jest
        .spyOn(keysAdapter.ReceiptsApi, 'get')
        .mockResolvedValue({ ok: true, data: receipt })

      jest.spyOn(fileStorageAdapter, 'uploadFile').mockResolvedValue({
        ok: false,
        err: 'unknown',
      })

      const res = await request(app.callback())
        .post('/receipts/00000000-0000-0000-0000-000000000001/upload')
        .send({ fileData: 'base64data' })

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
        { limit: '5' }
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
    it('responds with created key event on success', async () => {
      const newKeyEvent = factory.keyEvent.build()

      jest
        .spyOn(keysAdapter.KeyEventsApi, 'create')
        .mockResolvedValue({ ok: true, data: newKeyEvent })

      const res = await request(app.callback())
        .post('/key-events')
        .send({
          keys: JSON.stringify(['key-1']),
          type: 'FLEX',
        })

      expect(res.status).toBe(201)
      expect(res.body.content.id).toBe(newKeyEvent.id)
    })

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
    it('responds with updated key event on success', async () => {
      const updatedKeyEvent = factory.keyEvent.build()

      jest
        .spyOn(keysAdapter.KeyEventsApi, 'update')
        .mockResolvedValue({ ok: true, data: updatedKeyEvent })

      const res = await request(app.callback())
        .put(`/key-events/${updatedKeyEvent.id}`)
        .send({ status: 'COMPLETED' })

      expect(res.status).toBe(200)
      expect(res.body.content.id).toBe(updatedKeyEvent.id)
    })

    it('responds with 404 if key event not found', async () => {
      jest
        .spyOn(keysAdapter.KeyEventsApi, 'update')
        .mockResolvedValue({ ok: false, err: 'not-found' })

      const res = await request(app.callback())
        .put('/key-events/00000000-0000-0000-0000-000000000999')
        .send({ status: 'COMPLETED' })

      expect(res.status).toBe(404)
    })

    it('responds with 400 on bad request', async () => {
      jest
        .spyOn(keysAdapter.KeyEventsApi, 'update')
        .mockResolvedValue({ ok: false, err: 'bad-request' })

      const res = await request(app.callback())
        .put('/key-events/00000000-0000-0000-0000-000000000001')
        .send({ invalid: 'data' })

      expect(res.status).toBe(400)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.KeyEventsApi, 'update')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback())
        .put('/key-events/00000000-0000-0000-0000-000000000001')
        .send({ status: 'COMPLETED' })

      expect(res.status).toBe(500)
    })
  })

  // ============================================================================
  // Signatures Routes
  // ============================================================================

  describe('POST /signatures/send', () => {
    it('responds with 201 on successful signature request sent', async () => {
      const signatureResponse = factory.signature.build({
        recipientEmail: 'test@example.com',
      })

      jest
        .spyOn(keysAdapter.SignaturesApi, 'send')
        .mockResolvedValue({ ok: true, data: signatureResponse })

      const res = await request(app.callback()).post('/signatures/send').send({
        recipientEmail: 'test@example.com',
        resourceType: 'key-loan',
        resourceId: '00000000-0000-0000-0000-000000000001',
      })

      expect(res.status).toBe(201)
      expect(res.body.content.recipientEmail).toBe('test@example.com')
    })

    it('responds with 400 on bad request', async () => {
      jest
        .spyOn(keysAdapter.SignaturesApi, 'send')
        .mockResolvedValue({ ok: false, err: 'bad-request' })

      const res = await request(app.callback())
        .post('/signatures/send')
        .send({})

      expect(res.status).toBe(400)
    })

    it('responds with 404 if resource not found', async () => {
      jest
        .spyOn(keysAdapter.SignaturesApi, 'send')
        .mockResolvedValue({ ok: false, err: 'not-found' })

      const res = await request(app.callback())
        .post('/signatures/send')
        .send({ recipientEmail: 'test@example.com' })

      expect(res.status).toBe(404)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.SignaturesApi, 'send')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback())
        .post('/signatures/send')
        .send({ recipientEmail: 'test@example.com' })

      expect(res.status).toBe(500)
    })
  })

  describe('GET /signatures/:id', () => {
    it('responds with signature on success', async () => {
      const signature = factory.signature.build()

      jest
        .spyOn(keysAdapter.SignaturesApi, 'get')
        .mockResolvedValue({ ok: true, data: signature })

      const res = await request(app.callback()).get(
        `/signatures/${signature.id}`
      )

      expect(res.status).toBe(200)
      expect(res.body.content.id).toBe(signature.id)
    })

    it('responds with 404 if signature not found', async () => {
      jest
        .spyOn(keysAdapter.SignaturesApi, 'get')
        .mockResolvedValue({ ok: false, err: 'not-found' })

      const res = await request(app.callback()).get(
        '/signatures/00000000-0000-0000-0000-000000000999'
      )

      expect(res.status).toBe(404)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.SignaturesApi, 'get')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get(
        '/signatures/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(500)
    })
  })

  describe('GET /signatures/resource/:resourceType/:resourceId', () => {
    it('responds with signatures for resource on success', async () => {
      const signatures = factory.signature.buildList(2)

      jest
        .spyOn(keysAdapter.SignaturesApi, 'getByResource')
        .mockResolvedValue({ ok: true, data: signatures })

      const res = await request(app.callback()).get(
        '/signatures/resource/key-loan/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveLength(2)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(keysAdapter.SignaturesApi, 'getByResource')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get(
        '/signatures/resource/key-loan/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(500)
    })
  })
})
