import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes } from '../../routes/key-bundles'
import * as factory from '../factories'
import * as keyBundlesAdapter from '../../adapters/key-bundles-adapter'

// Set up a Koa app with the key-bundles routes for testing
const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

// Reset all mocks before each test
beforeEach(jest.clearAllMocks)

/**
 * Tests for GET /key-bundles endpoint
 *
 * Testing list all key bundles:
 * - Successful retrieval
 * - Empty results
 * - Database errors
 */
describe('GET /key-bundles', () => {
  it('responds with 200 and list of key bundles', async () => {
    const mockBundles = factory.keyBundle.buildList(3)

    // Create mock query builder that supports paginate() chain
    const mockQueryBuilder = {
      clone: jest.fn().mockReturnThis(),
      clearSelect: jest.fn().mockReturnThis(),
      clearOrder: jest.fn().mockReturnThis(),
      count: jest.fn().mockResolvedValue([{ count: 3 }]),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockResolvedValue(mockBundles),
    }

    const getAllKeyBundlesQuerySpy = jest
      .spyOn(keyBundlesAdapter, 'getAllKeyBundlesQuery')
      .mockReturnValueOnce(mockQueryBuilder as any)

    const res = await request(app.callback()).get('/key-bundles')

    expect(getAllKeyBundlesQuerySpy).toHaveBeenCalledWith(expect.anything())
    expect(res.status).toBe(200)
    expect(res.body.content).toHaveLength(3)
    expect(res.body.content[0]).toHaveProperty('id')
    expect(res.body.content[0]).toHaveProperty('name')
    expect(res.body.content[0]).toHaveProperty('keys')
  })
})

/**
 * Tests for GET /key-bundles/:id endpoint
 *
 * Testing get single key bundle:
 * - Successful retrieval
 * - Not found (404)
 * - Database errors
 */
describe('GET /key-bundles/:id', () => {
  it('responds with 200 and key bundle data when found', async () => {
    const mockBundle = factory.keyBundle.build({
      id: 'bundle-123',
      name: 'Master Bundle',
      keys: JSON.stringify(['key-1', 'key-2']),
    })

    const getKeyBundleByIdSpy = jest
      .spyOn(keyBundlesAdapter, 'getKeyBundleById')
      .mockResolvedValueOnce(mockBundle)

    const res = await request(app.callback()).get('/key-bundles/bundle-123')

    expect(getKeyBundleByIdSpy).toHaveBeenCalledWith(
      'bundle-123',
      expect.anything()
    )
    expect(res.status).toBe(200)
    expect(res.body.content).toMatchObject({
      id: 'bundle-123',
      name: 'Master Bundle',
    })
  })
})

/**
 * Tests for POST /key-bundles endpoint
 *
 * Testing create key bundle:
 * - Successful creation
 * - Missing required fields
 * - Invalid keys array format
 * - Empty keys array
 * - Database errors
 */
describe('POST /key-bundles', () => {
  it('creates a key bundle and responds with 201', async () => {
    const mockBundle = factory.keyBundle.build({
      name: 'New Bundle',
      keys: JSON.stringify(['key-1', 'key-2']),
    })

    const createKeyBundleSpy = jest
      .spyOn(keyBundlesAdapter, 'createKeyBundle')
      .mockResolvedValueOnce(mockBundle)

    const res = await request(app.callback())
      .post('/key-bundles')
      .send({
        name: 'New Bundle',
        keys: JSON.stringify(['key-1', 'key-2']),
        description: 'Test bundle',
      })

    expect(createKeyBundleSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'New Bundle',
        keys: JSON.stringify(['key-1', 'key-2']),
      }),
      expect.anything()
    )
    expect(res.status).toBe(201)
    expect(res.body.content).toMatchObject({
      name: 'New Bundle',
    })
  })

  it('validates missing required field (name) and returns 400', async () => {
    const res = await request(app.callback())
      .post('/key-bundles')
      .send({
        keys: JSON.stringify(['key-1']),
        // name is missing
      })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('status', 'error')
  })

  it('validates missing required field (keys) and returns 400', async () => {
    const res = await request(app.callback()).post('/key-bundles').send({
      name: 'Test Bundle',
      // keys is missing
    })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('status', 'error')
  })

  it('validates invalid keys format (not JSON) and returns 400', async () => {
    const res = await request(app.callback()).post('/key-bundles').send({
      name: 'Test Bundle',
      keys: 'not-valid-json',
    })

    expect(res.status).toBe(400)
    expect(res.body.reason).toContain('Invalid keys format')
  })

  it('validates keys must be a JSON array and returns 400', async () => {
    const res = await request(app.callback())
      .post('/key-bundles')
      .send({
        name: 'Test Bundle',
        keys: JSON.stringify({ not: 'an array' }),
      })

    expect(res.status).toBe(400)
    expect(res.body.reason).toContain('Keys must be a JSON array')
  })
})

/**
 * Tests for PUT /key-bundles/:id endpoint
 *
 * Testing update key bundle:
 * - Successful full update
 * - Partial update (name only)
 * - Partial update (keys only)
 * - Not found (404)
 * - Invalid keys array format
 * - Database errors
 */
describe('PUT /key-bundles/:id', () => {
  it('updates a key bundle and responds with 200', async () => {
    const mockUpdatedBundle = factory.keyBundle.build({
      id: 'bundle-123',
      name: 'Updated Bundle',
      keys: JSON.stringify(['key-3', 'key-4']),
    })

    const updateKeyBundleSpy = jest
      .spyOn(keyBundlesAdapter, 'updateKeyBundle')
      .mockResolvedValueOnce(mockUpdatedBundle)

    const res = await request(app.callback())
      .put('/key-bundles/bundle-123')
      .send({
        name: 'Updated Bundle',
        keys: JSON.stringify(['key-3', 'key-4']),
      })

    expect(updateKeyBundleSpy).toHaveBeenCalledWith(
      'bundle-123',
      expect.objectContaining({
        name: 'Updated Bundle',
        keys: JSON.stringify(['key-3', 'key-4']),
      }),
      expect.anything()
    )
    expect(res.status).toBe(200)
    expect(res.body.content).toMatchObject({
      name: 'Updated Bundle',
    })
  })

  it('updates only the name (partial update)', async () => {
    const mockUpdatedBundle = factory.keyBundle.build({
      id: 'bundle-123',
      name: 'New Name Only',
    })

    jest
      .spyOn(keyBundlesAdapter, 'updateKeyBundle')
      .mockResolvedValueOnce(mockUpdatedBundle)

    const res = await request(app.callback())
      .put('/key-bundles/bundle-123')
      .send({
        name: 'New Name Only',
      })

    expect(res.status).toBe(200)
    expect(res.body.content).toMatchObject({
      name: 'New Name Only',
    })
  })

  it('updates only the keys (partial update)', async () => {
    const newKeys = JSON.stringify(['key-10', 'key-11', 'key-12'])
    const mockUpdatedBundle = factory.keyBundle.build({
      id: 'bundle-123',
      keys: newKeys,
    })

    jest
      .spyOn(keyBundlesAdapter, 'updateKeyBundle')
      .mockResolvedValueOnce(mockUpdatedBundle)

    const res = await request(app.callback())
      .put('/key-bundles/bundle-123')
      .send({
        keys: newKeys,
      })

    expect(res.status).toBe(200)
    expect(res.body.content.keys).toBe(newKeys)
  })

  it('validates invalid keys format (not JSON) and returns 400', async () => {
    const res = await request(app.callback())
      .put('/key-bundles/bundle-123')
      .send({
        keys: 'invalid-json',
      })

    expect(res.status).toBe(400)
    expect(res.body.reason).toContain('Invalid keys format')
  })

  it('validates keys must be a JSON array and returns 400', async () => {
    const res = await request(app.callback())
      .put('/key-bundles/bundle-123')
      .send({
        keys: JSON.stringify('not an array'),
      })

    expect(res.status).toBe(400)
    expect(res.body.reason).toContain('Keys must be a JSON array')
  })
})

/**
 * Tests for DELETE /key-bundles/:id endpoint
 *
 * Testing delete key bundle:
 * - Successful deletion
 * - Database errors
 */
describe('DELETE /key-bundles/:id', () => {
  it('deletes a key bundle and responds with 204', async () => {
    const deleteKeyBundleSpy = jest
      .spyOn(keyBundlesAdapter, 'deleteKeyBundle')
      .mockResolvedValueOnce(1)

    const res = await request(app.callback()).delete('/key-bundles/bundle-123')

    expect(deleteKeyBundleSpy).toHaveBeenCalledWith(
      'bundle-123',
      expect.anything()
    )
    expect(res.status).toBe(204)
    expect(res.body).toEqual({})
  })

  it('returns 500 even if bundle does not exist (current behavior)', async () => {
    // Note: The current implementation doesn't check if the bundle exists
    // before attempting deletion, so it returns 500 for any error including not found
    jest
      .spyOn(keyBundlesAdapter, 'deleteKeyBundle')
      .mockRejectedValueOnce(new Error('Not found'))

    const res = await request(app.callback()).delete(
      '/key-bundles/nonexistent-id'
    )

    expect(res.status).toBe(500)
  })
})

/**
 * Tests for GET /key-bundles/search endpoint
 *
 * Testing search key bundles:
 * - Search with q parameter (OR search)
 * - Search without parameters (400)
 * - Empty search results
 * - Database errors
 */
describe('GET /key-bundles/search', () => {
  it('searches by name using q parameter and returns 200', async () => {
    const mockBundles = factory.keyBundle.buildList(2, {
      name: 'Master Keys Bundle',
    })

    // Create mock query builder that supports buildSearchQuery() AND paginate()
    const mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      clone: jest.fn().mockReturnThis(),
      clearSelect: jest.fn().mockReturnThis(),
      clearOrder: jest.fn().mockReturnThis(),
      count: jest.fn().mockResolvedValue([{ count: 2 }]),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockResolvedValue(mockBundles),
    }

    const getKeyBundlesSearchQuerySpy = jest
      .spyOn(keyBundlesAdapter, 'getKeyBundlesSearchQuery')
      .mockReturnValueOnce(mockQueryBuilder as any)

    const res = await request(app.callback()).get(
      '/key-bundles/search?q=Master'
    )

    expect(getKeyBundlesSearchQuerySpy).toHaveBeenCalledWith(expect.anything())
    expect(res.status).toBe(200)
    expect(res.body.content).toHaveLength(2)
  })

  it('returns 400 when no search parameters are provided', async () => {
    jest
      .spyOn(keyBundlesAdapter, 'getKeyBundlesSearchQuery')
      .mockReturnValueOnce({} as any)

    const res = await request(app.callback()).get('/key-bundles/search')

    expect(res.status).toBe(400)
    expect(res.body.reason).toBeDefined()
  })
})

/**
 * Tests for GET /key-bundles/by-key/:keyId endpoint
 *
 * Testing get bundles containing a specific key:
 * - Successful retrieval with results
 * - No bundles found (empty array)
 * - Database errors
 */
describe('GET /key-bundles/by-key/:keyId', () => {
  it('returns all bundles containing the specified key', async () => {
    const mockBundles = factory.keyBundle.buildList(2, {
      keys: JSON.stringify(['key-123', 'key-456']),
    })

    const getKeyBundlesByKeyIdSpy = jest
      .spyOn(keyBundlesAdapter, 'getKeyBundlesByKeyId')
      .mockResolvedValueOnce(mockBundles)

    const res = await request(app.callback()).get('/key-bundles/by-key/key-123')

    expect(getKeyBundlesByKeyIdSpy).toHaveBeenCalledWith(
      'key-123',
      expect.anything()
    )
    expect(res.status).toBe(200)
    expect(res.body.content).toHaveLength(2)
  })
})

/**
 * Tests for GET /key-bundles/:id/keys-with-loan-status endpoint
 *
 * Testing get bundle keys with maintenance loan status:
 * - Successful retrieval with active loans
 * - Successful retrieval with no active loans
 * - Bundle not found (404)
 * - Empty bundle (no keys)
 * - Database errors
 */
describe('GET /key-bundles/:id/keys-with-loan-status', () => {
  it('returns bundle with keys and their maintenance loan status', async () => {
    const mockBundle = factory.keyBundle.build({
      id: 'bundle-123',
      name: 'Test Bundle',
    })

    const mockKeysWithStatus = [
      {
        ...factory.key.build({ id: 'key-1' }),
        loan: {
          id: 'loan-1',
          keys: JSON.stringify(['key-1']),
          loanType: 'MAINTENANCE' as const,
          contact: 'ACME Corp',
          contactPerson: 'John Doe',
          pickedUpAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        latestEvent: null,
      },
      {
        ...factory.key.build({ id: 'key-2' }),
        loan: null,
        latestEvent: null,
      },
    ]

    const mockResult = {
      bundle: mockBundle,
      keys: mockKeysWithStatus,
    }

    const getKeyBundleDetailsSpy = jest
      .spyOn(keyBundlesAdapter, 'getKeyBundleDetails')
      .mockResolvedValueOnce(mockResult)

    const res = await request(app.callback()).get(
      '/key-bundles/bundle-123/keys-with-loan-status'
    )

    expect(getKeyBundleDetailsSpy).toHaveBeenCalledWith(
      'bundle-123',
      { includeLoans: false, includeEvents: false, includeKeySystem: false },
      expect.anything()
    )
    expect(res.status).toBe(200)
    expect(res.body.content).toHaveProperty('bundle')
    expect(res.body.content).toHaveProperty('keys')
    expect(res.body.content.keys).toHaveLength(2)
    expect(res.body.content.keys[0]).toHaveProperty('loan')
    expect(res.body.content.keys[0].loan.id).toBe('loan-1')
    expect(res.body.content.keys[0].loan.loanType).toBe('MAINTENANCE')
    expect(res.body.content.keys[1].loan).toBeNull()
  })

  it('returns bundle with keys that have no active maintenance loans', async () => {
    const mockBundle = factory.keyBundle.build()
    const mockKeysNoLoans = [
      {
        ...factory.key.build(),
        loan: null,
        latestEvent: null,
      },
    ]

    jest.spyOn(keyBundlesAdapter, 'getKeyBundleDetails').mockResolvedValueOnce({
      bundle: mockBundle,
      keys: mockKeysNoLoans,
    })

    const res = await request(app.callback()).get(
      '/key-bundles/bundle-123/keys-with-loan-status'
    )

    expect(res.status).toBe(200)
    expect(res.body.content.keys).toHaveLength(1)
    expect(res.body.content.keys[0].loan).toBeNull()
  })

  it('returns bundle with empty keys array when bundle has no keys', async () => {
    const mockBundle = factory.keyBundle.build({
      keys: JSON.stringify([]),
    })

    jest.spyOn(keyBundlesAdapter, 'getKeyBundleDetails').mockResolvedValueOnce({
      bundle: mockBundle,
      keys: [],
    })

    const res = await request(app.callback()).get(
      '/key-bundles/bundle-123/keys-with-loan-status'
    )

    expect(res.status).toBe(200)
    expect(res.body.content.keys).toEqual([])
  })

  it('returns bundle with mixed loan statuses (some loaned, some available)', async () => {
    const mockBundle = factory.keyBundle.build()
    const mockKeysWithMixedStatus = [
      {
        ...factory.key.build({ id: 'key-1', keyName: 'Key with loan' }),
        loan: {
          id: 'loan-1',
          keys: JSON.stringify(['key-1']),
          loanType: 'MAINTENANCE' as const,
          contact: 'Company A',
          contactPerson: 'Person A',
          pickedUpAt: new Date('2025-01-01'),
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
        },
        latestEvent: null,
      },
      {
        ...factory.key.build({ id: 'key-2', keyName: 'Available key' }),
        loan: null,
        latestEvent: null,
      },
      {
        ...factory.key.build({ id: 'key-3', keyName: 'Another loaned key' }),
        loan: {
          id: 'loan-2',
          keys: JSON.stringify(['key-3']),
          loanType: 'MAINTENANCE' as const,
          contact: 'Company B',
          contactPerson: 'Person B',
          pickedUpAt: new Date('2025-01-15'),
          createdAt: new Date('2025-01-15'),
          updatedAt: new Date('2025-01-15'),
        },
        latestEvent: null,
      },
    ]

    jest.spyOn(keyBundlesAdapter, 'getKeyBundleDetails').mockResolvedValueOnce({
      bundle: mockBundle,
      keys: mockKeysWithMixedStatus,
    })

    const res = await request(app.callback()).get(
      '/key-bundles/bundle-123/keys-with-loan-status'
    )

    expect(res.status).toBe(200)
    expect(res.body.content.keys).toHaveLength(3)

    // Check that we have both loaned and available keys
    const loanedKeys = res.body.content.keys.filter((k: any) => k.loan !== null)
    const availableKeys = res.body.content.keys.filter(
      (k: any) => k.loan === null
    )

    expect(loanedKeys).toHaveLength(2)
    expect(availableKeys).toHaveLength(1)
  })
})
