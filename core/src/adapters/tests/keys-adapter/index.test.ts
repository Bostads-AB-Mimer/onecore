import nock from 'nock'
import assert from 'node:assert'
import config from '../../../common/config'
import * as keysAdapter from '../../keys-adapter'
import {
  mockedKey,
  mockedKeySystem,
  mockedPaginatedKeys,
  mockedPaginatedKeySystems,
} from './mocks'

describe('keys-adapter', () => {
  afterEach(() => {
    nock.cleanAll()
  })

  // ============================================================================
  // KeysApi Tests
  // ============================================================================

  describe('KeysApi', () => {
    describe(keysAdapter.KeysApi.list, () => {
      it('returns ok with paginated keys on 200', async () => {
        nock(config.keysService.url)
          .get('/keys')
          .reply(200, mockedPaginatedKeys)

        const result = await keysAdapter.KeysApi.list()

        assert(result.ok)
        expect(result.data).toEqual(mockedPaginatedKeys)
        expect(result.data.content).toHaveLength(1)
      })

      it('returns ok with pagination params', async () => {
        nock(config.keysService.url)
          .get('/keys?page=2&limit=10')
          .reply(200, mockedPaginatedKeys)

        const result = await keysAdapter.KeysApi.list(2, 10)

        assert(result.ok)
        expect(result.data).toEqual(mockedPaginatedKeys)
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url).get('/keys').reply(500)

        const result = await keysAdapter.KeysApi.list()

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.KeysApi.search, () => {
      it('returns ok with search results on 200', async () => {
        nock(config.keysService.url)
          .get('/keys/search?rentalObjectCode=123-456-789%2F1')
          .reply(200, mockedPaginatedKeys)

        const result = await keysAdapter.KeysApi.search({
          rentalObjectCode: '123-456-789/1',
        })

        assert(result.ok)
        expect(result.data).toEqual(mockedPaginatedKeys)
      })

      it('handles array parameters', async () => {
        nock(config.keysService.url)
          .get('/keys/search?keyType=LGH&keyType=PB')
          .reply(200, mockedPaginatedKeys)

        const result = await keysAdapter.KeysApi.search({
          keyType: ['LGH', 'PB'],
        })

        assert(result.ok)
        expect(result.data).toEqual(mockedPaginatedKeys)
      })

      it('returns bad-request on 400', async () => {
        nock(config.keysService.url)
          .get('/keys/search?invalid=param')
          .reply(400)

        const result = await keysAdapter.KeysApi.search({ invalid: 'param' })

        expect(result).toEqual({ ok: false, err: 'bad-request' })
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url).get('/keys/search?query=test').reply(500)

        const result = await keysAdapter.KeysApi.search({ query: 'test' })

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.KeysApi.getByRentalObjectCode, () => {
      it('returns ok with keys array on 200', async () => {
        nock(config.keysService.url)
          .get(/\/keys\/by-rental-object\/.*/)
          .reply(200, { content: [mockedKey] })

        const result =
          await keysAdapter.KeysApi.getByRentalObjectCode('123-456-789/1')

        assert(result.ok)
        expect(result.data).toEqual([mockedKey])
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url)
          .get(/\/keys\/by-rental-object\/.*/)
          .reply(500)

        const result =
          await keysAdapter.KeysApi.getByRentalObjectCode('123-456-789/1')

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.KeysApi.get, () => {
      it('returns ok with key on 200', async () => {
        nock(config.keysService.url)
          .get('/keys/00000000-0000-0000-0000-000000000001')
          .reply(200, { content: mockedKey })

        const result = await keysAdapter.KeysApi.get(
          '00000000-0000-0000-0000-000000000001'
        )

        assert(result.ok)
        expect(result.data).toEqual(mockedKey)
      })

      it('returns not-found on 404', async () => {
        nock(config.keysService.url)
          .get('/keys/00000000-0000-0000-0000-000000000999')
          .reply(404)

        const result = await keysAdapter.KeysApi.get(
          '00000000-0000-0000-0000-000000000999'
        )

        expect(result).toEqual({ ok: false, err: 'not-found' })
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url)
          .get('/keys/00000000-0000-0000-0000-000000000001')
          .reply(500)

        const result = await keysAdapter.KeysApi.get(
          '00000000-0000-0000-0000-000000000001'
        )

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.KeysApi.create, () => {
      it('returns ok with created key on 201', async () => {
        const createPayload = {
          keyName: 'New Key',
          keyType: 'LGH' as const,
          flexNumber: 1,
        }

        nock(config.keysService.url)
          .post('/keys', createPayload)
          .reply(201, { content: mockedKey })

        const result = await keysAdapter.KeysApi.create(createPayload)

        assert(result.ok)
        expect(result.data).toEqual(mockedKey)
      })

      it('returns bad-request on 400', async () => {
        nock(config.keysService.url).post('/keys').reply(400)

        const result = await keysAdapter.KeysApi.create({})

        expect(result).toEqual({ ok: false, err: 'bad-request' })
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url).post('/keys').reply(500)

        const result = await keysAdapter.KeysApi.create({ keyName: 'Test' })

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.KeysApi.update, () => {
      it('returns ok with updated key on 200', async () => {
        const updatePayload = { keyName: 'Updated Key' }
        const updatedKey = { ...mockedKey, keyName: 'Updated Key' }

        nock(config.keysService.url)
          .patch('/keys/00000000-0000-0000-0000-000000000001', updatePayload)
          .reply(200, { content: updatedKey })

        const result = await keysAdapter.KeysApi.update(
          '00000000-0000-0000-0000-000000000001',
          updatePayload
        )

        assert(result.ok)
        expect(result.data).toEqual(updatedKey)
      })

      it('returns not-found on 404', async () => {
        nock(config.keysService.url)
          .patch('/keys/00000000-0000-0000-0000-000000000999')
          .reply(404)

        const result = await keysAdapter.KeysApi.update(
          '00000000-0000-0000-0000-000000000999',
          { keyName: 'Test' }
        )

        expect(result).toEqual({ ok: false, err: 'not-found' })
      })

      it('returns bad-request on 400', async () => {
        nock(config.keysService.url)
          .patch('/keys/00000000-0000-0000-0000-000000000001')
          .reply(400)

        const result = await keysAdapter.KeysApi.update(
          '00000000-0000-0000-0000-000000000001',
          { keyType: 'INVALID' as any }
        )

        expect(result).toEqual({ ok: false, err: 'bad-request' })
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url)
          .patch('/keys/00000000-0000-0000-0000-000000000001')
          .reply(500)

        const result = await keysAdapter.KeysApi.update(
          '00000000-0000-0000-0000-000000000001',
          { keyName: 'Test' }
        )

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.KeysApi.remove, () => {
      it('returns ok on 200', async () => {
        nock(config.keysService.url)
          .delete('/keys/00000000-0000-0000-0000-000000000001')
          .reply(200)

        const result = await keysAdapter.KeysApi.remove(
          '00000000-0000-0000-0000-000000000001'
        )

        assert(result.ok)
      })

      it('returns not-found on 404', async () => {
        nock(config.keysService.url)
          .delete('/keys/00000000-0000-0000-0000-000000000999')
          .reply(404)

        const result = await keysAdapter.KeysApi.remove(
          '00000000-0000-0000-0000-000000000999'
        )

        expect(result).toEqual({ ok: false, err: 'not-found' })
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url)
          .delete('/keys/00000000-0000-0000-0000-000000000001')
          .reply(500)

        const result = await keysAdapter.KeysApi.remove(
          '00000000-0000-0000-0000-000000000001'
        )

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.KeysApi.bulkUpdateFlex, () => {
      it('returns ok with updated count on 200', async () => {
        const payload = {
          rentalObjectCode: '123-456-789/1',
          flexNumber: 5,
        }

        nock(config.keysService.url)
          .post('/keys/bulk-update-flex', payload)
          .reply(200, { content: 3 })

        const result = await keysAdapter.KeysApi.bulkUpdateFlex(
          '123-456-789/1',
          5
        )

        assert(result.ok)
        expect(result.data).toBe(3)
      })

      it('returns bad-request on 400', async () => {
        nock(config.keysService.url).post('/keys/bulk-update-flex').reply(400)

        const result = await keysAdapter.KeysApi.bulkUpdateFlex(
          '123-456-789/1',
          -1
        )

        expect(result).toEqual({ ok: false, err: 'bad-request' })
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url).post('/keys/bulk-update-flex').reply(500)

        const result = await keysAdapter.KeysApi.bulkUpdateFlex(
          '123-456-789/1',
          5
        )

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })
  })

  // ============================================================================
  // KeySystemsApi Tests
  // ============================================================================

  describe('KeySystemsApi', () => {
    describe(keysAdapter.KeySystemsApi.list, () => {
      it('returns ok with paginated key systems on 200', async () => {
        nock(config.keysService.url)
          .get('/key-systems')
          .reply(200, mockedPaginatedKeySystems)

        const result = await keysAdapter.KeySystemsApi.list()

        assert(result.ok)
        expect(result.data).toEqual(mockedPaginatedKeySystems)
      })

      it('returns ok with pagination params', async () => {
        nock(config.keysService.url)
          .get('/key-systems?page=2&limit=10')
          .reply(200, mockedPaginatedKeySystems)

        const result = await keysAdapter.KeySystemsApi.list(2, 10)

        assert(result.ok)
        expect(result.data).toEqual(mockedPaginatedKeySystems)
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url).get('/key-systems').reply(500)

        const result = await keysAdapter.KeySystemsApi.list()

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.KeySystemsApi.search, () => {
      it('returns ok with search results on 200', async () => {
        nock(config.keysService.url)
          .get('/key-systems/search?manufacturer=ASSA%20ABLOY')
          .reply(200, mockedPaginatedKeySystems)

        const result = await keysAdapter.KeySystemsApi.search({
          manufacturer: 'ASSA ABLOY',
        })

        assert(result.ok)
        expect(result.data).toEqual(mockedPaginatedKeySystems)
      })

      it('handles array parameters', async () => {
        nock(config.keysService.url)
          .get('/key-systems/search?type=MECHANICAL&type=ELECTRONIC')
          .reply(200, mockedPaginatedKeySystems)

        const result = await keysAdapter.KeySystemsApi.search({
          type: ['MECHANICAL', 'ELECTRONIC'],
        })

        assert(result.ok)
        expect(result.data).toEqual(mockedPaginatedKeySystems)
      })

      it('returns bad-request on 400', async () => {
        nock(config.keysService.url)
          .get('/key-systems/search?invalid=param')
          .reply(400)

        const result = await keysAdapter.KeySystemsApi.search({
          invalid: 'param',
        })

        expect(result).toEqual({ ok: false, err: 'bad-request' })
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url)
          .get('/key-systems/search?query=test')
          .reply(500)

        const result = await keysAdapter.KeySystemsApi.search({ query: 'test' })

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.KeySystemsApi.get, () => {
      it('returns ok with key system on 200', async () => {
        nock(config.keysService.url)
          .get('/key-systems/00000000-0000-0000-0000-000000000001')
          .reply(200, { content: mockedKeySystem })

        const result = await keysAdapter.KeySystemsApi.get(
          '00000000-0000-0000-0000-000000000001'
        )

        assert(result.ok)
        expect(result.data).toEqual(mockedKeySystem)
      })

      it('returns not-found on 404', async () => {
        nock(config.keysService.url)
          .get('/key-systems/00000000-0000-0000-0000-000000000999')
          .reply(404)

        const result = await keysAdapter.KeySystemsApi.get(
          '00000000-0000-0000-0000-000000000999'
        )

        expect(result).toEqual({ ok: false, err: 'not-found' })
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url)
          .get('/key-systems/00000000-0000-0000-0000-000000000001')
          .reply(500)

        const result = await keysAdapter.KeySystemsApi.get(
          '00000000-0000-0000-0000-000000000001'
        )

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.KeySystemsApi.create, () => {
      it('returns ok with created key system on 201', async () => {
        const createPayload = {
          systemCode: 'SYS-002',
          name: 'New System',
          manufacturer: 'ASSA ABLOY',
          type: 'ELECTRONIC' as const,
        }

        nock(config.keysService.url)
          .post('/key-systems', createPayload)
          .reply(201, { content: mockedKeySystem })

        const result = await keysAdapter.KeySystemsApi.create(createPayload)

        assert(result.ok)
        expect(result.data).toEqual(mockedKeySystem)
      })

      it('returns bad-request on 400', async () => {
        nock(config.keysService.url).post('/key-systems').reply(400)

        const result = await keysAdapter.KeySystemsApi.create({})

        expect(result).toEqual({ ok: false, err: 'bad-request' })
      })

      it('returns conflict on 409', async () => {
        nock(config.keysService.url).post('/key-systems').reply(409)

        const result = await keysAdapter.KeySystemsApi.create({
          systemCode: 'SYS-001',
          name: 'Duplicate',
          manufacturer: 'Test',
          type: 'MECHANICAL',
        })

        expect(result).toEqual({ ok: false, err: 'conflict' })
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url).post('/key-systems').reply(500)

        const result = await keysAdapter.KeySystemsApi.create({
          systemCode: 'SYS-002',
          name: 'Test',
          manufacturer: 'Test',
          type: 'MECHANICAL',
        })

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.KeySystemsApi.update, () => {
      it('returns ok with updated key system on 200', async () => {
        const updatePayload = { name: 'Updated System' }
        const updatedSystem = { ...mockedKeySystem, name: 'Updated System' }

        nock(config.keysService.url)
          .patch(
            '/key-systems/00000000-0000-0000-0000-000000000001',
            updatePayload
          )
          .reply(200, { content: updatedSystem })

        const result = await keysAdapter.KeySystemsApi.update(
          '00000000-0000-0000-0000-000000000001',
          updatePayload
        )

        assert(result.ok)
        expect(result.data).toEqual(updatedSystem)
      })

      it('returns not-found on 404', async () => {
        nock(config.keysService.url)
          .patch('/key-systems/00000000-0000-0000-0000-000000000999')
          .reply(404)

        const result = await keysAdapter.KeySystemsApi.update(
          '00000000-0000-0000-0000-000000000999',
          { name: 'Test' }
        )

        expect(result).toEqual({ ok: false, err: 'not-found' })
      })

      it('returns conflict on 409', async () => {
        nock(config.keysService.url)
          .patch('/key-systems/00000000-0000-0000-0000-000000000001')
          .reply(409)

        const result = await keysAdapter.KeySystemsApi.update(
          '00000000-0000-0000-0000-000000000001',
          { systemCode: 'SYS-002' }
        )

        expect(result).toEqual({ ok: false, err: 'conflict' })
      })

      it('returns bad-request on 400', async () => {
        nock(config.keysService.url)
          .patch('/key-systems/00000000-0000-0000-0000-000000000001')
          .reply(400)

        const result = await keysAdapter.KeySystemsApi.update(
          '00000000-0000-0000-0000-000000000001',
          { type: 'INVALID' as any }
        )

        expect(result).toEqual({ ok: false, err: 'bad-request' })
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url)
          .patch('/key-systems/00000000-0000-0000-0000-000000000001')
          .reply(500)

        const result = await keysAdapter.KeySystemsApi.update(
          '00000000-0000-0000-0000-000000000001',
          { name: 'Test' }
        )

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.KeySystemsApi.remove, () => {
      it('returns ok on 200', async () => {
        nock(config.keysService.url)
          .delete('/key-systems/00000000-0000-0000-0000-000000000001')
          .reply(200)

        const result = await keysAdapter.KeySystemsApi.remove(
          '00000000-0000-0000-0000-000000000001'
        )

        assert(result.ok)
      })

      it('returns not-found on 404', async () => {
        nock(config.keysService.url)
          .delete('/key-systems/00000000-0000-0000-0000-000000000999')
          .reply(404)

        const result = await keysAdapter.KeySystemsApi.remove(
          '00000000-0000-0000-0000-000000000999'
        )

        expect(result).toEqual({ ok: false, err: 'not-found' })
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url)
          .delete('/key-systems/00000000-0000-0000-0000-000000000001')
          .reply(500)

        const result = await keysAdapter.KeySystemsApi.remove(
          '00000000-0000-0000-0000-000000000001'
        )

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })
  })
})
