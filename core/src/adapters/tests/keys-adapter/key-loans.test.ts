import nock from 'nock'
import assert from 'node:assert'
import config from '../../../common/config'
import * as keysAdapter from '../../keys-adapter'
import { mockedKeyLoan, mockedLog } from './mocks'

describe('keys-adapter - KeyLoans & Logs', () => {
  afterEach(() => {
    nock.cleanAll()
  })

  // ============================================================================
  // KeyLoansApi Tests
  // ============================================================================

  describe('KeyLoansApi', () => {
    describe(keysAdapter.KeyLoansApi.list, () => {
      it('returns ok with key loans array on 200', async () => {
        nock(config.keysService.url)
          .get('/key-loans')
          .reply(200, { content: [mockedKeyLoan] })

        const result = await keysAdapter.KeyLoansApi.list()

        assert(result.ok)
        expect(result.data).toEqual([mockedKeyLoan])
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url).get('/key-loans').reply(500)

        const result = await keysAdapter.KeyLoansApi.list()

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.KeyLoansApi.search, () => {
      it('returns ok with search results on 200', async () => {
        const paginatedResponse = {
          content: [mockedKeyLoan],
          _meta: { totalRecords: 1, page: 1, limit: 10, count: 1 },
          _links: [{ href: '/key-loans/search?contact=P123456', rel: 'self' }],
        }

        nock(config.keysService.url)
          .get('/key-loans/search?contact=P123456')
          .reply(200, paginatedResponse)

        const result = await keysAdapter.KeyLoansApi.search({
          contact: 'P123456',
        })

        assert(result.ok)
        expect(result.data).toEqual(paginatedResponse)
      })

      it('handles array parameters', async () => {
        const paginatedResponse = {
          content: [mockedKeyLoan],
          _meta: { totalRecords: 1, page: 1, limit: 10, count: 1 },
          _links: [
            { href: '/key-loans/search?keys=key1&keys=key2', rel: 'self' },
          ],
        }

        nock(config.keysService.url)
          .get('/key-loans/search?keys=key1&keys=key2')
          .reply(200, paginatedResponse)

        const result = await keysAdapter.KeyLoansApi.search({
          keys: ['key1', 'key2'],
        })

        assert(result.ok)
        expect(result.data).toEqual(paginatedResponse)
      })

      it('returns bad-request on 400', async () => {
        nock(config.keysService.url)
          .get('/key-loans/search?invalid=param')
          .reply(400)

        const result = await keysAdapter.KeyLoansApi.search({
          invalid: 'param',
        })

        expect(result).toEqual({ ok: false, err: 'bad-request' })
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url)
          .get('/key-loans/search?contact=P123')
          .reply(500)

        const result = await keysAdapter.KeyLoansApi.search({ contact: 'P123' })

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.KeyLoansApi.getByKey, () => {
      it('returns ok with key loans for specific key on 200', async () => {
        nock(config.keysService.url)
          .get('/key-loans/by-key/00000000-0000-0000-0000-000000000001')
          .reply(200, { content: [mockedKeyLoan] })

        const result = await keysAdapter.KeyLoansApi.getByKey(
          '00000000-0000-0000-0000-000000000001'
        )

        assert(result.ok)
        expect(result.data).toEqual([mockedKeyLoan])
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url)
          .get('/key-loans/by-key/00000000-0000-0000-0000-000000000001')
          .reply(500)

        const result = await keysAdapter.KeyLoansApi.getByKey(
          '00000000-0000-0000-0000-000000000001'
        )

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.KeyLoansApi.get, () => {
      it('returns ok with key loan on 200', async () => {
        nock(config.keysService.url)
          .get('/key-loans/00000000-0000-0000-0000-000000000001')
          .reply(200, { content: mockedKeyLoan })

        const result = await keysAdapter.KeyLoansApi.get(
          '00000000-0000-0000-0000-000000000001'
        )

        assert(result.ok)
        expect(result.data).toEqual(mockedKeyLoan)
      })

      it('returns not-found on 404', async () => {
        nock(config.keysService.url)
          .get('/key-loans/00000000-0000-0000-0000-000000000999')
          .reply(404)

        const result = await keysAdapter.KeyLoansApi.get(
          '00000000-0000-0000-0000-000000000999'
        )

        expect(result).toEqual({ ok: false, err: 'not-found' })
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url)
          .get('/key-loans/00000000-0000-0000-0000-000000000001')
          .reply(500)

        const result = await keysAdapter.KeyLoansApi.get(
          '00000000-0000-0000-0000-000000000001'
        )

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.KeyLoansApi.create, () => {
      it('returns ok with created key loan on 201', async () => {
        const createPayload = {
          keys: ['key-1', 'key-2'],
          loanType: 'TENANT' as const,
          contact: 'P123456',
        }

        nock(config.keysService.url)
          .post('/key-loans', createPayload)
          .reply(201, { content: mockedKeyLoan })

        const result = await keysAdapter.KeyLoansApi.create(createPayload)

        assert(result.ok)
        expect(result.data).toEqual(mockedKeyLoan)
      })

      it('returns bad-request on 400', async () => {
        nock(config.keysService.url).post('/key-loans').reply(400)

        const result = await keysAdapter.KeyLoansApi.create({
          loanType: 'TENANT',
        })

        expect(result).toEqual({ ok: false, err: 'bad-request' })
      })

      it('returns conflict on 409 when keys already loaned', async () => {
        nock(config.keysService.url).post('/key-loans').reply(409)

        const result = await keysAdapter.KeyLoansApi.create({
          keys: ['key-1'],
          loanType: 'TENANT',
          contact: 'P123456',
        })

        expect(result).toEqual({ ok: false, err: 'conflict' })
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url).post('/key-loans').reply(500)

        const result = await keysAdapter.KeyLoansApi.create({
          keys: ['key-1'],
          loanType: 'TENANT',
          contact: 'P123456',
        })

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.KeyLoansApi.update, () => {
      it('returns ok with updated key loan on 200', async () => {
        const updatePayload = {
          returnedAt: new Date('2024-02-01T00:00:00.000Z'),
        }
        const updatedKeyLoan = {
          ...mockedKeyLoan,
          returnedAt: '2024-02-01T00:00:00.000Z',
        }

        nock(config.keysService.url)
          .patch('/key-loans/00000000-0000-0000-0000-000000000001')
          .reply(200, { content: updatedKeyLoan })

        const result = await keysAdapter.KeyLoansApi.update(
          '00000000-0000-0000-0000-000000000001',
          updatePayload
        )

        assert(result.ok)
        expect(result.data).toEqual(updatedKeyLoan)
      })

      it('returns not-found on 404', async () => {
        nock(config.keysService.url)
          .patch('/key-loans/00000000-0000-0000-0000-000000000999')
          .reply(404)

        const result = await keysAdapter.KeyLoansApi.update(
          '00000000-0000-0000-0000-000000000999',
          { returnedAt: new Date('2024-02-01T00:00:00.000Z') }
        )

        expect(result).toEqual({ ok: false, err: 'not-found' })
      })

      it('returns bad-request on 400', async () => {
        nock(config.keysService.url)
          .patch('/key-loans/00000000-0000-0000-0000-000000000001')
          .reply(400)

        const result = await keysAdapter.KeyLoansApi.update(
          '00000000-0000-0000-0000-000000000001',
          { contact: '' }
        )

        expect(result).toEqual({ ok: false, err: 'bad-request' })
      })

      it('returns conflict on 409', async () => {
        nock(config.keysService.url)
          .patch('/key-loans/00000000-0000-0000-0000-000000000001')
          .reply(409)

        const result = await keysAdapter.KeyLoansApi.update(
          '00000000-0000-0000-0000-000000000001',
          { keys: ['key-2'] }
        )

        expect(result).toEqual({ ok: false, err: 'conflict' })
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url)
          .patch('/key-loans/00000000-0000-0000-0000-000000000001')
          .reply(500)

        const result = await keysAdapter.KeyLoansApi.update(
          '00000000-0000-0000-0000-000000000001',
          { contact: 'P123456' }
        )

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.KeyLoansApi.remove, () => {
      it('returns ok on 200', async () => {
        nock(config.keysService.url)
          .delete('/key-loans/00000000-0000-0000-0000-000000000001')
          .reply(200)

        const result = await keysAdapter.KeyLoansApi.remove(
          '00000000-0000-0000-0000-000000000001'
        )

        assert(result.ok)
      })

      it('returns not-found on 404', async () => {
        nock(config.keysService.url)
          .delete('/key-loans/00000000-0000-0000-0000-000000000999')
          .reply(404)

        const result = await keysAdapter.KeyLoansApi.remove(
          '00000000-0000-0000-0000-000000000999'
        )

        expect(result).toEqual({ ok: false, err: 'not-found' })
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url)
          .delete('/key-loans/00000000-0000-0000-0000-000000000001')
          .reply(500)

        const result = await keysAdapter.KeyLoansApi.remove(
          '00000000-0000-0000-0000-000000000001'
        )

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })
  })

  // ============================================================================
  // LogsApi Tests
  // ============================================================================

  describe('LogsApi', () => {
    describe(keysAdapter.LogsApi.list, () => {
      it('returns ok with paginated logs on 200', async () => {
        const paginatedResponse = {
          content: [mockedLog],
          _meta: {
            totalRecords: 1,
            page: 1,
            limit: 20,
            count: 1,
          },
          _links: [{ href: '/logs?page=1&limit=20', rel: 'self' }],
        }

        nock(config.keysService.url).get('/logs').reply(200, paginatedResponse)

        const result = await keysAdapter.LogsApi.list()

        assert(result.ok)
        expect(result.data).toEqual(paginatedResponse)
      })

      it('returns ok with pagination params', async () => {
        const paginatedResponse = {
          content: [],
          _meta: { totalRecords: 0, page: 2, limit: 10, count: 0 },
          _links: [],
        }

        nock(config.keysService.url)
          .get('/logs?page=2&limit=10')
          .reply(200, paginatedResponse)

        const result = await keysAdapter.LogsApi.list(2, 10)

        assert(result.ok)
        expect(result.data).toEqual(paginatedResponse)
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url).get('/logs').reply(500)

        const result = await keysAdapter.LogsApi.list()

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.LogsApi.search, () => {
      it('returns ok with search results on 200', async () => {
        const paginatedResponse = {
          content: [mockedLog],
          _meta: { totalRecords: 1, page: 1, limit: 20, count: 1 },
          _links: [],
        }

        nock(config.keysService.url)
          .get('/logs/search?eventType=creation')
          .reply(200, paginatedResponse)

        const result = await keysAdapter.LogsApi.search({
          eventType: 'creation',
        })

        assert(result.ok)
        expect(result.data).toEqual(paginatedResponse)
      })

      it('handles array parameters', async () => {
        const paginatedResponse = {
          content: [],
          _meta: { totalRecords: 0, page: 1, limit: 20, count: 0 },
          _links: [],
        }

        nock(config.keysService.url)
          .get('/logs/search?objectType=key&objectType=keyLoan')
          .reply(200, paginatedResponse)

        const result = await keysAdapter.LogsApi.search({
          objectType: ['key', 'keyLoan'],
        })

        assert(result.ok)
        expect(result.data).toEqual(paginatedResponse)
      })

      it('returns bad-request on 400', async () => {
        nock(config.keysService.url)
          .get('/logs/search?invalid=param')
          .reply(400)

        const result = await keysAdapter.LogsApi.search({ invalid: 'param' })

        expect(result).toEqual({ ok: false, err: 'bad-request' })
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url)
          .get('/logs/search?userName=test')
          .reply(500)

        const result = await keysAdapter.LogsApi.search({ userName: 'test' })

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.LogsApi.get, () => {
      it('returns ok with log on 200', async () => {
        nock(config.keysService.url)
          .get('/logs/00000000-0000-0000-0000-000000000001')
          .reply(200, { content: mockedLog })

        const result = await keysAdapter.LogsApi.get(
          '00000000-0000-0000-0000-000000000001'
        )

        assert(result.ok)
        expect(result.data).toEqual(mockedLog)
      })

      it('returns not-found on 404', async () => {
        nock(config.keysService.url)
          .get('/logs/00000000-0000-0000-0000-000000000999')
          .reply(404)

        const result = await keysAdapter.LogsApi.get(
          '00000000-0000-0000-0000-000000000999'
        )

        expect(result).toEqual({ ok: false, err: 'not-found' })
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url)
          .get('/logs/00000000-0000-0000-0000-000000000001')
          .reply(500)

        const result = await keysAdapter.LogsApi.get(
          '00000000-0000-0000-0000-000000000001'
        )

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.LogsApi.getByObjectId, () => {
      it('returns ok with logs for specific object on 200', async () => {
        nock(config.keysService.url)
          .get('/logs/object/00000000-0000-0000-0000-000000000001')
          .reply(200, { content: [mockedLog] })

        const result = await keysAdapter.LogsApi.getByObjectId(
          '00000000-0000-0000-0000-000000000001'
        )

        assert(result.ok)
        expect(result.data).toEqual([mockedLog])
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url)
          .get('/logs/object/00000000-0000-0000-0000-000000000001')
          .reply(500)

        const result = await keysAdapter.LogsApi.getByObjectId(
          '00000000-0000-0000-0000-000000000001'
        )

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.LogsApi.create, () => {
      it('returns ok with created log on 201', async () => {
        const createPayload = {
          userName: 'test-user@mimer.nu',
          eventType: 'creation' as const,
          objectType: 'key' as const,
          objectId: '00000000-0000-0000-0000-000000000001',
          eventTime: new Date(),
          description: 'Created new key',
        }

        nock(config.keysService.url)
          .post('/logs')
          .reply(201, { content: mockedLog })

        const result = await keysAdapter.LogsApi.create(createPayload)

        assert(result.ok)
        expect(result.data).toEqual(mockedLog)
      })

      it('returns bad-request on 400', async () => {
        nock(config.keysService.url).post('/logs').reply(400)

        const result = await keysAdapter.LogsApi.create({})

        expect(result).toEqual({ ok: false, err: 'bad-request' })
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url).post('/logs').reply(500)

        const result = await keysAdapter.LogsApi.create({
          userName: 'test',
          eventType: 'creation',
          objectType: 'key',
          eventTime: new Date(),
        })

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })
  })
})
