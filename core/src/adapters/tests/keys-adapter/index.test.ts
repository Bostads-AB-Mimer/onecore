import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import assert from 'node:assert'
import config from '../../../common/config'
import * as keysAdapter from '../../keys-adapter'
import * as factory from '../../../../test/factories'
import { keys } from '@onecore/types'

const { KeySchema, KeySystemSchema } = keys

const mockedKey = JSON.parse(JSON.stringify(factory.key.build()))
const mockedKeySystem = JSON.parse(JSON.stringify(factory.keySystem.build()))

const expectedKey = KeySchema.parse(mockedKey)
const expectedKeySystem = KeySystemSchema.parse(mockedKeySystem)

const mockedPaginatedKeys = {
  content: [mockedKey],
  _meta: { totalRecords: 1, page: 1, limit: 20, count: 1 },
  _links: [
    { href: '/keys?page=1&limit=20', rel: 'self' },
    { href: '/keys?page=1&limit=20', rel: 'first' },
    { href: '/keys?page=1&limit=20', rel: 'last' },
  ],
}

const expectedPaginatedKeys = { ...mockedPaginatedKeys, content: [expectedKey] }

const mockedPaginatedKeySystems = {
  content: [mockedKeySystem],
  _meta: { totalRecords: 1, page: 1, limit: 20, count: 1 },
  _links: [
    { href: '/key-systems?page=1&limit=20', rel: 'self' },
    { href: '/key-systems?page=1&limit=20', rel: 'first' },
    { href: '/key-systems?page=1&limit=20', rel: 'last' },
  ],
}

const expectedPaginatedKeySystems = {
  ...mockedPaginatedKeySystems,
  content: [expectedKeySystem],
}

const mockServer = setupServer()

describe('keys-adapter', () => {
  beforeAll(() => {
    mockServer.listen()
  })

  afterEach(() => {
    mockServer.resetHandlers()
  })

  afterAll(() => {
    mockServer.close()
  })

  // ============================================================================
  // KeysApi Tests
  // ============================================================================

  describe('KeysApi', () => {
    describe(keysAdapter.KeysApi.list, () => {
      it('returns ok with paginated keys on 200', async () => {
        mockServer.use(
          http.get(`${config.keysService.url}/keys`, () =>
            HttpResponse.json(mockedPaginatedKeys, { status: 200 })
          )
        )

        const result = await keysAdapter.KeysApi.list({})

        assert(result.ok)
        expect(result.data).toEqual(expectedPaginatedKeys)
        expect(result.data.content).toHaveLength(1)
      })

      it('returns ok with pagination params', async () => {
        mockServer.use(
          http.get(`${config.keysService.url}/keys`, () =>
            HttpResponse.json(mockedPaginatedKeys, { status: 200 })
          )
        )

        const result = await keysAdapter.KeysApi.list({ page: '2', limit: '10' })

        assert(result.ok)
        expect(result.data).toEqual(expectedPaginatedKeys)
      })

      it('returns unknown on 500', async () => {
        mockServer.use(
          http.get(
            `${config.keysService.url}/keys`,
            () => new HttpResponse(null, { status: 500 })
          )
        )

        const result = await keysAdapter.KeysApi.list({})

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.KeysApi.search, () => {
      it('returns ok with search results on 200', async () => {
        mockServer.use(
          http.get(`${config.keysService.url}/keys/search`, () =>
            HttpResponse.json(mockedPaginatedKeys, { status: 200 })
          )
        )

        const result = await keysAdapter.KeysApi.search({
          rentalObjectCode: '123-456-789/1',
        })

        assert(result.ok)
        expect(result.data).toEqual(expectedPaginatedKeys)
      })

      it('handles array parameters', async () => {
        mockServer.use(
          http.get(`${config.keysService.url}/keys/search`, () =>
            HttpResponse.json(mockedPaginatedKeys, { status: 200 })
          )
        )

        const result = await keysAdapter.KeysApi.search({
          keyType: ['LGH', 'PB'],
        })

        assert(result.ok)
        expect(result.data).toEqual(expectedPaginatedKeys)
      })

      it('returns bad-request on 400', async () => {
        mockServer.use(
          http.get(
            `${config.keysService.url}/keys/search`,
            () => new HttpResponse(null, { status: 400 })
          )
        )

        const result = await keysAdapter.KeysApi.search({ invalid: 'param' })

        expect(result).toEqual({ ok: false, err: 'bad-request' })
      })

      it('returns unknown on 500', async () => {
        mockServer.use(
          http.get(
            `${config.keysService.url}/keys/search`,
            () => new HttpResponse(null, { status: 500 })
          )
        )

        const result = await keysAdapter.KeysApi.search({ query: 'test' })

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.KeysApi.getByRentalObjectCode, () => {
      it('returns ok with keys array on 200', async () => {
        mockServer.use(
          http.get(
            `${config.keysService.url}/keys/by-rental-object/:rentalObjectCode`,
            () => HttpResponse.json({ content: [mockedKey] }, { status: 200 })
          )
        )

        const result =
          await keysAdapter.KeysApi.getByRentalObjectCode('123-456-789/1')

        assert(result.ok)
        expect(result.data).toEqual([expectedKey])
      })

      it('returns unknown on 500', async () => {
        mockServer.use(
          http.get(
            `${config.keysService.url}/keys/by-rental-object/:rentalObjectCode`,
            () => new HttpResponse(null, { status: 500 })
          )
        )

        const result =
          await keysAdapter.KeysApi.getByRentalObjectCode('123-456-789/1')

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.KeysApi.get, () => {
      it('returns ok with key on 200', async () => {
        mockServer.use(
          http.get(`${config.keysService.url}/keys/:id`, () =>
            HttpResponse.json({ content: mockedKey }, { status: 200 })
          )
        )

        const result = await keysAdapter.KeysApi.get(
          '00000000-0000-0000-0000-000000000001'
        )

        assert(result.ok)
        expect(result.data).toEqual(expectedKey)
      })

      it('returns not-found on 404', async () => {
        mockServer.use(
          http.get(
            `${config.keysService.url}/keys/:id`,
            () => new HttpResponse(null, { status: 404 })
          )
        )

        const result = await keysAdapter.KeysApi.get(
          '00000000-0000-0000-0000-000000000999'
        )

        expect(result).toEqual({ ok: false, err: 'not-found' })
      })

      it('returns unknown on 500', async () => {
        mockServer.use(
          http.get(
            `${config.keysService.url}/keys/:id`,
            () => new HttpResponse(null, { status: 500 })
          )
        )

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

        mockServer.use(
          http.post(`${config.keysService.url}/keys`, () =>
            HttpResponse.json({ content: mockedKey }, { status: 201 })
          )
        )

        const result = await keysAdapter.KeysApi.create(createPayload)

        assert(result.ok)
        expect(result.data).toEqual(expectedKey)
      })

      it('returns bad-request on 400', async () => {
        mockServer.use(
          http.post(
            `${config.keysService.url}/keys`,
            () => new HttpResponse(null, { status: 400 })
          )
        )

        const result = await keysAdapter.KeysApi.create({})

        expect(result).toEqual({ ok: false, err: 'bad-request' })
      })

      it('returns unknown on 500', async () => {
        mockServer.use(
          http.post(
            `${config.keysService.url}/keys`,
            () => new HttpResponse(null, { status: 500 })
          )
        )

        const result = await keysAdapter.KeysApi.create({ keyName: 'Test' })

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.KeysApi.update, () => {
      it('returns ok with updated key on 200', async () => {
        const updatePayload = { keyName: 'Updated Key' }
        const updatedKey = { ...mockedKey, keyName: 'Updated Key' }

        mockServer.use(
          http.put(`${config.keysService.url}/keys/:id`, () =>
            HttpResponse.json({ content: updatedKey }, { status: 200 })
          )
        )

        const result = await keysAdapter.KeysApi.update(
          '00000000-0000-0000-0000-000000000001',
          updatePayload
        )

        assert(result.ok)
        expect(result.data).toEqual(KeySchema.parse(updatedKey))
      })

      it('returns not-found on 404', async () => {
        mockServer.use(
          http.put(
            `${config.keysService.url}/keys/:id`,
            () => new HttpResponse(null, { status: 404 })
          )
        )

        const result = await keysAdapter.KeysApi.update(
          '00000000-0000-0000-0000-000000000999',
          { keyName: 'Test' }
        )

        expect(result).toEqual({ ok: false, err: 'not-found' })
      })

      it('returns bad-request on 400', async () => {
        mockServer.use(
          http.put(
            `${config.keysService.url}/keys/:id`,
            () => new HttpResponse(null, { status: 400 })
          )
        )

        const result = await keysAdapter.KeysApi.update(
          '00000000-0000-0000-0000-000000000001',
          { keyType: 'INVALID' as any }
        )

        expect(result).toEqual({ ok: false, err: 'bad-request' })
      })

      it('returns unknown on 500', async () => {
        mockServer.use(
          http.put(
            `${config.keysService.url}/keys/:id`,
            () => new HttpResponse(null, { status: 500 })
          )
        )

        const result = await keysAdapter.KeysApi.update(
          '00000000-0000-0000-0000-000000000001',
          { keyName: 'Test' }
        )

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.KeysApi.remove, () => {
      it('returns ok on 200', async () => {
        mockServer.use(
          http.delete(`${config.keysService.url}/keys/:id`, () =>
            HttpResponse.json(undefined, { status: 200 })
          )
        )

        const result = await keysAdapter.KeysApi.remove(
          '00000000-0000-0000-0000-000000000001'
        )

        assert(result.ok)
      })

      it('returns not-found on 404', async () => {
        mockServer.use(
          http.delete(
            `${config.keysService.url}/keys/:id`,
            () => new HttpResponse(null, { status: 404 })
          )
        )

        const result = await keysAdapter.KeysApi.remove(
          '00000000-0000-0000-0000-000000000999'
        )

        expect(result).toEqual({ ok: false, err: 'not-found' })
      })

      it('returns unknown on 500', async () => {
        mockServer.use(
          http.delete(
            `${config.keysService.url}/keys/:id`,
            () => new HttpResponse(null, { status: 500 })
          )
        )

        const result = await keysAdapter.KeysApi.remove(
          '00000000-0000-0000-0000-000000000001'
        )

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.KeysApi.bulkUpdateFlex, () => {
      it('returns ok with updated count on 200', async () => {
        mockServer.use(
          http.post(`${config.keysService.url}/keys/bulk-update-flex`, () =>
            HttpResponse.json({ content: 3 }, { status: 200 })
          )
        )

        const result = await keysAdapter.KeysApi.bulkUpdateFlex(
          '123-456-789/1',
          5
        )

        assert(result.ok)
        expect(result.data).toBe(3)
      })

      it('returns bad-request on 400', async () => {
        mockServer.use(
          http.post(
            `${config.keysService.url}/keys/bulk-update-flex`,
            () => new HttpResponse(null, { status: 400 })
          )
        )

        const result = await keysAdapter.KeysApi.bulkUpdateFlex(
          '123-456-789/1',
          -1
        )

        expect(result).toEqual({ ok: false, err: 'bad-request' })
      })

      it('returns unknown on 500', async () => {
        mockServer.use(
          http.post(
            `${config.keysService.url}/keys/bulk-update-flex`,
            () => new HttpResponse(null, { status: 500 })
          )
        )

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
        mockServer.use(
          http.get(`${config.keysService.url}/key-systems`, () =>
            HttpResponse.json(mockedPaginatedKeySystems, { status: 200 })
          )
        )

        const result = await keysAdapter.KeySystemsApi.list({})

        assert(result.ok)
        expect(result.data).toEqual(expectedPaginatedKeySystems)
      })

      it('returns ok with pagination params', async () => {
        mockServer.use(
          http.get(`${config.keysService.url}/key-systems`, () =>
            HttpResponse.json(mockedPaginatedKeySystems, { status: 200 })
          )
        )

        const result = await keysAdapter.KeySystemsApi.list({ page: '2', limit: '10' })

        assert(result.ok)
        expect(result.data).toEqual(expectedPaginatedKeySystems)
      })

      it('returns unknown on 500', async () => {
        mockServer.use(
          http.get(
            `${config.keysService.url}/key-systems`,
            () => new HttpResponse(null, { status: 500 })
          )
        )

        const result = await keysAdapter.KeySystemsApi.list({})

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.KeySystemsApi.search, () => {
      it('returns ok with search results on 200', async () => {
        mockServer.use(
          http.get(`${config.keysService.url}/key-systems/search`, () =>
            HttpResponse.json(mockedPaginatedKeySystems, { status: 200 })
          )
        )

        const result = await keysAdapter.KeySystemsApi.search({
          manufacturer: 'ASSA ABLOY',
        })

        assert(result.ok)
        expect(result.data).toEqual(expectedPaginatedKeySystems)
      })

      it('handles array parameters', async () => {
        mockServer.use(
          http.get(`${config.keysService.url}/key-systems/search`, () =>
            HttpResponse.json(mockedPaginatedKeySystems, { status: 200 })
          )
        )

        const result = await keysAdapter.KeySystemsApi.search({
          type: ['MECHANICAL', 'ELECTRONIC'],
        })

        assert(result.ok)
        expect(result.data).toEqual(expectedPaginatedKeySystems)
      })

      it('returns bad-request on 400', async () => {
        mockServer.use(
          http.get(
            `${config.keysService.url}/key-systems/search`,
            () => new HttpResponse(null, { status: 400 })
          )
        )

        const result = await keysAdapter.KeySystemsApi.search({
          invalid: 'param',
        })

        expect(result).toEqual({ ok: false, err: 'bad-request' })
      })

      it('returns unknown on 500', async () => {
        mockServer.use(
          http.get(
            `${config.keysService.url}/key-systems/search`,
            () => new HttpResponse(null, { status: 500 })
          )
        )

        const result = await keysAdapter.KeySystemsApi.search({ query: 'test' })

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.KeySystemsApi.get, () => {
      it('returns ok with key system on 200', async () => {
        mockServer.use(
          http.get(`${config.keysService.url}/key-systems/:id`, () =>
            HttpResponse.json({ content: mockedKeySystem }, { status: 200 })
          )
        )

        const result = await keysAdapter.KeySystemsApi.get(
          '00000000-0000-0000-0000-000000000001'
        )

        assert(result.ok)
        expect(result.data).toEqual(expectedKeySystem)
      })

      it('returns not-found on 404', async () => {
        mockServer.use(
          http.get(
            `${config.keysService.url}/key-systems/:id`,
            () => new HttpResponse(null, { status: 404 })
          )
        )

        const result = await keysAdapter.KeySystemsApi.get(
          '00000000-0000-0000-0000-000000000999'
        )

        expect(result).toEqual({ ok: false, err: 'not-found' })
      })

      it('returns unknown on 500', async () => {
        mockServer.use(
          http.get(
            `${config.keysService.url}/key-systems/:id`,
            () => new HttpResponse(null, { status: 500 })
          )
        )

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

        mockServer.use(
          http.post(`${config.keysService.url}/key-systems`, () =>
            HttpResponse.json({ content: mockedKeySystem }, { status: 201 })
          )
        )

        const result = await keysAdapter.KeySystemsApi.create(createPayload)

        assert(result.ok)
        expect(result.data).toEqual(expectedKeySystem)
      })

      it('returns bad-request on 400', async () => {
        mockServer.use(
          http.post(
            `${config.keysService.url}/key-systems`,
            () => new HttpResponse(null, { status: 400 })
          )
        )

        const result = await keysAdapter.KeySystemsApi.create({})

        expect(result).toEqual({ ok: false, err: 'bad-request' })
      })

      it('returns conflict on 409', async () => {
        mockServer.use(
          http.post(
            `${config.keysService.url}/key-systems`,
            () => new HttpResponse(null, { status: 409 })
          )
        )

        const result = await keysAdapter.KeySystemsApi.create({
          systemCode: 'SYS-001',
          name: 'Duplicate',
          manufacturer: 'Test',
          type: 'MECHANICAL',
        })

        expect(result).toEqual({ ok: false, err: 'conflict' })
      })

      it('returns unknown on 500', async () => {
        mockServer.use(
          http.post(
            `${config.keysService.url}/key-systems`,
            () => new HttpResponse(null, { status: 500 })
          )
        )

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

        mockServer.use(
          http.put(`${config.keysService.url}/key-systems/:id`, () =>
            HttpResponse.json({ content: updatedSystem }, { status: 200 })
          )
        )

        const result = await keysAdapter.KeySystemsApi.update(
          '00000000-0000-0000-0000-000000000001',
          updatePayload
        )

        assert(result.ok)
        expect(result.data).toEqual(KeySystemSchema.parse(updatedSystem))
      })

      it('returns not-found on 404', async () => {
        mockServer.use(
          http.put(
            `${config.keysService.url}/key-systems/:id`,
            () => new HttpResponse(null, { status: 404 })
          )
        )

        const result = await keysAdapter.KeySystemsApi.update(
          '00000000-0000-0000-0000-000000000999',
          { name: 'Test' }
        )

        expect(result).toEqual({ ok: false, err: 'not-found' })
      })

      it('returns conflict on 409', async () => {
        mockServer.use(
          http.put(
            `${config.keysService.url}/key-systems/:id`,
            () => new HttpResponse(null, { status: 409 })
          )
        )

        const result = await keysAdapter.KeySystemsApi.update(
          '00000000-0000-0000-0000-000000000001',
          { systemCode: 'SYS-002' }
        )

        expect(result).toEqual({ ok: false, err: 'conflict' })
      })

      it('returns bad-request on 400', async () => {
        mockServer.use(
          http.put(
            `${config.keysService.url}/key-systems/:id`,
            () => new HttpResponse(null, { status: 400 })
          )
        )

        const result = await keysAdapter.KeySystemsApi.update(
          '00000000-0000-0000-0000-000000000001',
          { type: 'INVALID' as any }
        )

        expect(result).toEqual({ ok: false, err: 'bad-request' })
      })

      it('returns unknown on 500', async () => {
        mockServer.use(
          http.put(
            `${config.keysService.url}/key-systems/:id`,
            () => new HttpResponse(null, { status: 500 })
          )
        )

        const result = await keysAdapter.KeySystemsApi.update(
          '00000000-0000-0000-0000-000000000001',
          { name: 'Test' }
        )

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.KeySystemsApi.remove, () => {
      it('returns ok on 200', async () => {
        mockServer.use(
          http.delete(`${config.keysService.url}/key-systems/:id`, () =>
            HttpResponse.json(undefined, { status: 200 })
          )
        )

        const result = await keysAdapter.KeySystemsApi.remove(
          '00000000-0000-0000-0000-000000000001'
        )

        assert(result.ok)
      })

      it('returns not-found on 404', async () => {
        mockServer.use(
          http.delete(
            `${config.keysService.url}/key-systems/:id`,
            () => new HttpResponse(null, { status: 404 })
          )
        )

        const result = await keysAdapter.KeySystemsApi.remove(
          '00000000-0000-0000-0000-000000000999'
        )

        expect(result).toEqual({ ok: false, err: 'not-found' })
      })

      it('returns unknown on 500', async () => {
        mockServer.use(
          http.delete(
            `${config.keysService.url}/key-systems/:id`,
            () => new HttpResponse(null, { status: 500 })
          )
        )

        const result = await keysAdapter.KeySystemsApi.remove(
          '00000000-0000-0000-0000-000000000001'
        )

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })
  })
})
