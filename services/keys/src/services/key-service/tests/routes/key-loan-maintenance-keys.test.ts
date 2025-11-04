import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes } from '../../routes/key-loan-maintenance-keys'
import * as factory from '../factories'
import * as keyLoanMaintenanceKeysAdapter from '../../adapters/key-loan-maintenance-keys-adapter'
import * as maintenanceKeyLoanService from '../../key-loan-maintenance-keys-service'

// Set up a Koa app with the key-loan-maintenance-keys routes for testing
const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

// Reset all mocks before each test
beforeEach(jest.clearAllMocks)

/**
 * Tests for GET /key-loan-maintenance-keys endpoint
 *
 * Testing list all maintenance key loans:
 * - Successful retrieval
 * - Empty results
 * - Database errors
 */
describe('GET /key-loan-maintenance-keys', () => {
  it('responds with 200 and list of maintenance key loans', async () => {
    const mockLoans = factory.keyLoanMaintenanceKey.buildList(3)

    const getAllSpy = jest
      .spyOn(keyLoanMaintenanceKeysAdapter, 'getAllKeyLoanMaintenanceKeys')
      .mockResolvedValueOnce(mockLoans)

    const res = await request(app.callback()).get('/key-loan-maintenance-keys')

    expect(getAllSpy).toHaveBeenCalledWith(expect.anything())
    expect(res.status).toBe(200)
    expect(res.body.content).toHaveLength(3)
    expect(res.body.content[0]).toHaveProperty('id')
    expect(res.body.content[0]).toHaveProperty('company')
  })
})

/**
 * Tests for GET /key-loan-maintenance-keys/:id endpoint
 *
 * Testing get single maintenance key loan:
 * - Successful retrieval
 * - Not found (404)
 * - Database errors
 */
describe('GET /key-loan-maintenance-keys/:id', () => {
  it('responds with 200 and maintenance key loan data when found', async () => {
    const mockLoan = factory.keyLoanMaintenanceKey.build({
      id: 'loan-123',
      company: 'ACME Corp',
      contactPerson: 'John Doe',
    })

    const getByIdSpy = jest
      .spyOn(keyLoanMaintenanceKeysAdapter, 'getKeyLoanMaintenanceKeyById')
      .mockResolvedValueOnce(mockLoan)

    const res = await request(app.callback()).get(
      '/key-loan-maintenance-keys/loan-123'
    )

    expect(getByIdSpy).toHaveBeenCalledWith('loan-123', expect.anything())
    expect(res.status).toBe(200)
    expect(res.body.content).toMatchObject({
      id: 'loan-123',
      company: 'ACME Corp',
    })
  })
})

/**
 * Tests for GET /key-loan-maintenance-keys/search endpoint
 *
 * Testing search maintenance key loans:
 * - Search with q parameter (OR search)
 * - Search without parameters (400)
 * - Empty search results
 * - Database errors
 */
describe('GET /key-loan-maintenance-keys/search', () => {
  it('searches by company using q parameter and returns 200', async () => {
    const mockLoans = factory.keyLoanMaintenanceKey.buildList(2, {
      company: 'ACME Corp',
    })

    const getSearchQuerySpy = jest
      .spyOn(
        keyLoanMaintenanceKeysAdapter,
        'getKeyLoanMaintenanceKeysSearchQuery'
      )
      .mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValueOnce(mockLoans),
      } as any)

    const res = await request(app.callback()).get(
      '/key-loan-maintenance-keys/search?q=ACME'
    )

    expect(getSearchQuerySpy).toHaveBeenCalledWith(expect.anything())
    expect(res.status).toBe(200)
    expect(res.body.content).toHaveLength(2)
  })

  it('returns 400 when no search parameters are provided', async () => {
    jest
      .spyOn(
        keyLoanMaintenanceKeysAdapter,
        'getKeyLoanMaintenanceKeysSearchQuery'
      )
      .mockReturnValueOnce({} as any)

    const res = await request(app.callback()).get(
      '/key-loan-maintenance-keys/search'
    )

    expect(res.status).toBe(400)
    expect(res.body.reason).toBeDefined()
  })
})

/**
 * Tests for GET /key-loan-maintenance-keys/by-key/:keyId endpoint
 *
 * Testing get maintenance key loans for a specific key:
 * - Successful retrieval with results
 * - No loans found (empty array)
 * - Database errors
 */
describe('GET /key-loan-maintenance-keys/by-key/:keyId', () => {
  it('returns all maintenance loans containing the specified key', async () => {
    const mockLoans = factory.keyLoanMaintenanceKey.buildList(2, {
      keys: JSON.stringify(['key-123', 'key-456']),
    })

    const getByKeyIdSpy = jest
      .spyOn(keyLoanMaintenanceKeysAdapter, 'getKeyLoanMaintenanceKeysByKeyId')
      .mockResolvedValueOnce(mockLoans)

    const res = await request(app.callback()).get(
      '/key-loan-maintenance-keys/by-key/key-123'
    )

    expect(getByKeyIdSpy).toHaveBeenCalledWith('key-123', expect.anything())
    expect(res.status).toBe(200)
    expect(res.body.content).toHaveLength(2)
  })
})

/**
 * Tests for GET /key-loan-maintenance-keys/by-company/:company endpoint
 *
 * Testing get maintenance key loans for a specific company:
 * - Successful retrieval with results
 * - No loans found (empty array)
 * - Database errors
 */
describe('GET /key-loan-maintenance-keys/by-company/:company', () => {
  it('returns all maintenance loans for the specified company', async () => {
    const mockLoans = factory.keyLoanMaintenanceKey.buildList(3, {
      company: 'ACME Corp',
    })

    const getByCompanySpy = jest
      .spyOn(
        keyLoanMaintenanceKeysAdapter,
        'getKeyLoanMaintenanceKeysByCompany'
      )
      .mockResolvedValueOnce(mockLoans)

    const res = await request(app.callback()).get(
      '/key-loan-maintenance-keys/by-company/ACME%20Corp'
    )

    expect(getByCompanySpy).toHaveBeenCalledWith('ACME Corp', expect.anything())
    expect(res.status).toBe(200)
    expect(res.body.content).toHaveLength(3)
    expect(res.body.content[0].company).toBe('ACME Corp')
  })
})

/**
 * Tests for GET /key-loan-maintenance-keys/by-company/:company/with-keys endpoint
 *
 * Testing get maintenance key loans with full key details:
 * - Successful retrieval with all loans (no filter)
 * - Filter by returned=false (active loans only)
 * - Filter by returned=true (returned loans only)
 * - Empty results
 * - Database errors
 */
describe('GET /key-loan-maintenance-keys/by-company/:company/with-keys', () => {
  it('returns all loans with key details when no returned filter is provided', async () => {
    const mockLoansWithKeys = [
      {
        ...factory.keyLoanMaintenanceKey.build({ company: 'ACME Corp' }),
        keyDetails: [factory.key.build()],
      },
    ]

    const getWithKeysSpy = jest
      .spyOn(
        keyLoanMaintenanceKeysAdapter,
        'getKeyLoanMaintenanceKeysWithKeysByCompany'
      )
      .mockResolvedValueOnce(mockLoansWithKeys as any)

    const res = await request(app.callback()).get(
      '/key-loan-maintenance-keys/by-company/ACME%20Corp/with-keys'
    )

    expect(getWithKeysSpy).toHaveBeenCalledWith(
      'ACME Corp',
      undefined,
      expect.anything()
    )
    expect(res.status).toBe(200)
    expect(res.body.content).toHaveLength(1)
    expect(res.body.content[0]).toHaveProperty('keyDetails')
  })

  it('filters by returned=false to get only active loans', async () => {
    const mockActiveLoans = [
      {
        ...factory.keyLoanMaintenanceKey.build({
          company: 'ACME Corp',
          returnedAt: undefined,
        }),
        keyDetails: [factory.key.build()],
      },
    ]

    const getWithKeysSpy = jest
      .spyOn(
        keyLoanMaintenanceKeysAdapter,
        'getKeyLoanMaintenanceKeysWithKeysByCompany'
      )
      .mockResolvedValueOnce(mockActiveLoans as any)

    const res = await request(app.callback()).get(
      '/key-loan-maintenance-keys/by-company/ACME%20Corp/with-keys?returned=false'
    )

    expect(getWithKeysSpy).toHaveBeenCalledWith(
      'ACME Corp',
      false,
      expect.anything()
    )
    expect(res.status).toBe(200)
    expect(res.body.content).toHaveLength(1)
  })

  it('filters by returned=true to get only returned loans', async () => {
    const mockReturnedLoans = [
      {
        ...factory.keyLoanMaintenanceKey.build({
          company: 'ACME Corp',
          returnedAt: new Date(),
        }),
        keyDetails: [factory.key.build()],
      },
    ]

    const getWithKeysSpy = jest
      .spyOn(
        keyLoanMaintenanceKeysAdapter,
        'getKeyLoanMaintenanceKeysWithKeysByCompany'
      )
      .mockResolvedValueOnce(mockReturnedLoans as any)

    const res = await request(app.callback()).get(
      '/key-loan-maintenance-keys/by-company/ACME%20Corp/with-keys?returned=true'
    )

    expect(getWithKeysSpy).toHaveBeenCalledWith(
      'ACME Corp',
      true,
      expect.anything()
    )
    expect(res.status).toBe(200)
    expect(res.body.content).toHaveLength(1)
  })

  it('ignores invalid returned parameter values', async () => {
    const mockLoans = [
      {
        ...factory.keyLoanMaintenanceKey.build(),
        keyDetails: [factory.key.build()],
      },
    ]

    const getWithKeysSpy = jest
      .spyOn(
        keyLoanMaintenanceKeysAdapter,
        'getKeyLoanMaintenanceKeysWithKeysByCompany'
      )
      .mockResolvedValueOnce(mockLoans as any)

    const res = await request(app.callback()).get(
      '/key-loan-maintenance-keys/by-company/ACME/with-keys?returned=invalid'
    )

    // Should pass undefined when value is not 'true' or 'false'
    expect(getWithKeysSpy).toHaveBeenCalledWith(
      'ACME',
      undefined,
      expect.anything()
    )
    expect(res.status).toBe(200)
  })
})

/**
 * Tests for GET /key-loan-maintenance-keys/by-bundle/:bundleId/with-keys endpoint
 *
 * Testing get maintenance key loans for a bundle with full key details:
 * - Successful retrieval with all loans (no filter)
 * - Filter by returned=false (active loans only)
 * - Filter by returned=true (returned loans only)
 * - Empty results
 * - Database errors
 */
describe('GET /key-loan-maintenance-keys/by-bundle/:bundleId/with-keys', () => {
  it('returns all loans with key details for the bundle', async () => {
    const mockLoansWithKeys = [
      {
        ...factory.keyLoanMaintenanceKey.build(),
        keyDetails: [factory.key.build()],
      },
    ]

    const getWithKeysSpy = jest
      .spyOn(
        keyLoanMaintenanceKeysAdapter,
        'getKeyLoanMaintenanceKeysWithKeysByBundle'
      )
      .mockResolvedValueOnce(mockLoansWithKeys as any)

    const res = await request(app.callback()).get(
      '/key-loan-maintenance-keys/by-bundle/bundle-123/with-keys'
    )

    expect(getWithKeysSpy).toHaveBeenCalledWith(
      'bundle-123',
      undefined,
      expect.anything()
    )
    expect(res.status).toBe(200)
    expect(res.body.content).toHaveLength(1)
    expect(res.body.content[0]).toHaveProperty('keyDetails')
  })

  it('filters by returned=false to get only active loans for bundle', async () => {
    const mockActiveLoans = [
      {
        ...factory.keyLoanMaintenanceKey.build({ returnedAt: undefined }),
        keyDetails: [factory.key.build()],
      },
    ]

    const getWithKeysSpy = jest
      .spyOn(
        keyLoanMaintenanceKeysAdapter,
        'getKeyLoanMaintenanceKeysWithKeysByBundle'
      )
      .mockResolvedValueOnce(mockActiveLoans as any)

    const res = await request(app.callback()).get(
      '/key-loan-maintenance-keys/by-bundle/bundle-123/with-keys?returned=false'
    )

    expect(getWithKeysSpy).toHaveBeenCalledWith(
      'bundle-123',
      false,
      expect.anything()
    )
    expect(res.status).toBe(200)
    expect(res.body.content).toHaveLength(1)
  })

  it('filters by returned=true to get only returned loans for bundle', async () => {
    const mockReturnedLoans = [
      {
        ...factory.keyLoanMaintenanceKey.build({ returnedAt: new Date() }),
        keyDetails: [factory.key.build()],
      },
    ]

    const getWithKeysSpy = jest
      .spyOn(
        keyLoanMaintenanceKeysAdapter,
        'getKeyLoanMaintenanceKeysWithKeysByBundle'
      )
      .mockResolvedValueOnce(mockReturnedLoans as any)

    const res = await request(app.callback()).get(
      '/key-loan-maintenance-keys/by-bundle/bundle-123/with-keys?returned=true'
    )

    expect(getWithKeysSpy).toHaveBeenCalledWith(
      'bundle-123',
      true,
      expect.anything()
    )
    expect(res.status).toBe(200)
    expect(res.body.content).toHaveLength(1)
  })
})

/**
 * Tests for POST /key-loan-maintenance-keys endpoint
 *
 * Testing create maintenance key loan:
 * - Successful creation
 * - Missing required fields
 * - Invalid keys array format
 * - Database errors
 */
describe('POST /key-loan-maintenance-keys', () => {
  it('creates a maintenance key loan and responds with 201', async () => {
    const mockLoan = factory.keyLoanMaintenanceKey.build({
      company: 'ACME Corp',
      contactPerson: 'John Doe',
      keys: JSON.stringify(['key-1', 'key-2']),
    })

    const createSpy = jest
      .spyOn(keyLoanMaintenanceKeysAdapter, 'createKeyLoanMaintenanceKey')
      .mockResolvedValueOnce(mockLoan)

    const res = await request(app.callback())
      .post('/key-loan-maintenance-keys')
      .send({
        company: 'ACME Corp',
        contactPerson: 'John Doe',
        keys: JSON.stringify(['key-1', 'key-2']),
        description: 'Test maintenance loan',
      })

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        company: 'ACME Corp',
        contactPerson: 'John Doe',
      }),
      expect.anything()
    )
    expect(res.status).toBe(201)
    expect(res.body.content).toMatchObject({
      company: 'ACME Corp',
    })
  })

  it('validates missing required field (keys) and returns 400', async () => {
    const res = await request(app.callback())
      .post('/key-loan-maintenance-keys')
      .send({
        company: 'ACME Corp',
        // keys is missing
      })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('status', 'error')
  })

  it('validates invalid keys format (not JSON) and returns 400', async () => {
    const res = await request(app.callback())
      .post('/key-loan-maintenance-keys')
      .send({
        keys: 'not-valid-json',
        company: 'ACME Corp',
      })

    expect(res.status).toBe(400)
    expect(res.body.reason).toContain('Invalid keys format')
  })

  it('validates keys must be a JSON array and returns 400', async () => {
    const res = await request(app.callback())
      .post('/key-loan-maintenance-keys')
      .send({
        keys: JSON.stringify({ not: 'an array' }),
        company: 'ACME Corp',
      })

    expect(res.status).toBe(400)
    expect(res.body.reason).toContain('Keys must be a JSON array')
  })
})

/**
 * Tests for PATCH /key-loan-maintenance-keys/:id endpoint
 *
 * Testing update maintenance key loan:
 * - Successful full update
 * - Partial update (company only)
 * - Partial update (keys only)
 * - Not found (404)
 * - Invalid keys array format
 * - Database errors
 */
describe('PATCH /key-loan-maintenance-keys/:id', () => {
  it('updates a maintenance key loan and responds with 200', async () => {
    const mockUpdatedLoan = factory.keyLoanMaintenanceKey.build({
      id: 'loan-123',
      company: 'Updated Corp',
      keys: JSON.stringify(['key-3', 'key-4']),
    })

    // Mock the validation service to return success
    jest
      .spyOn(maintenanceKeyLoanService, 'validateMaintenanceKeyLoanUpdate')
      .mockResolvedValueOnce({ ok: true })

    const updateSpy = jest
      .spyOn(keyLoanMaintenanceKeysAdapter, 'updateKeyLoanMaintenanceKey')
      .mockResolvedValueOnce(mockUpdatedLoan)

    const res = await request(app.callback())
      .patch('/key-loan-maintenance-keys/loan-123')
      .send({
        company: 'Updated Corp',
        keys: JSON.stringify(['key-3', 'key-4']),
      })

    expect(updateSpy).toHaveBeenCalledWith(
      'loan-123',
      expect.objectContaining({
        company: 'Updated Corp',
      }),
      expect.anything()
    )
    expect(res.status).toBe(200)
    expect(res.body.content).toMatchObject({
      company: 'Updated Corp',
    })
  })

  it('updates only the company (partial update)', async () => {
    const mockUpdatedLoan = factory.keyLoanMaintenanceKey.build({
      id: 'loan-123',
      company: 'New Company Only',
    })

    // No validation mock needed when keys are not being updated
    jest
      .spyOn(keyLoanMaintenanceKeysAdapter, 'updateKeyLoanMaintenanceKey')
      .mockResolvedValueOnce(mockUpdatedLoan)

    const res = await request(app.callback())
      .patch('/key-loan-maintenance-keys/loan-123')
      .send({
        company: 'New Company Only',
      })

    expect(res.status).toBe(200)
    expect(res.body.content).toMatchObject({
      company: 'New Company Only',
    })
  })

  it('updates only the keys (partial update)', async () => {
    const newKeys = JSON.stringify(['key-10', 'key-11', 'key-12'])
    const mockUpdatedLoan = factory.keyLoanMaintenanceKey.build({
      id: 'loan-123',
      keys: newKeys,
    })

    // Mock the validation service to return success
    jest
      .spyOn(maintenanceKeyLoanService, 'validateMaintenanceKeyLoanUpdate')
      .mockResolvedValueOnce({ ok: true })

    jest
      .spyOn(keyLoanMaintenanceKeysAdapter, 'updateKeyLoanMaintenanceKey')
      .mockResolvedValueOnce(mockUpdatedLoan)

    const res = await request(app.callback())
      .patch('/key-loan-maintenance-keys/loan-123')
      .send({
        keys: newKeys,
      })

    expect(res.status).toBe(200)
    expect(res.body.content.keys).toBe(newKeys)
  })

  it('validates invalid keys format (not JSON) and returns 400', async () => {
    const res = await request(app.callback())
      .patch('/key-loan-maintenance-keys/loan-123')
      .send({
        keys: 'invalid-json',
      })

    expect(res.status).toBe(400)
    expect(res.body.reason).toContain('Invalid keys format')
  })

  it('validates keys must be a JSON array and returns 400', async () => {
    const res = await request(app.callback())
      .patch('/key-loan-maintenance-keys/loan-123')
      .send({
        keys: JSON.stringify('not an array'),
      })

    expect(res.status).toBe(400)
    expect(res.body.reason).toContain('Keys must be a JSON array')
  })
})

/**
 * Tests for DELETE /key-loan-maintenance-keys/:id endpoint
 *
 * Testing delete maintenance key loan:
 * - Successful deletion
 * - Database errors
 */
describe('DELETE /key-loan-maintenance-keys/:id', () => {
  it('deletes a maintenance key loan and responds with 204', async () => {
    const deleteSpy = jest
      .spyOn(keyLoanMaintenanceKeysAdapter, 'deleteKeyLoanMaintenanceKey')
      .mockResolvedValueOnce(1)

    const res = await request(app.callback()).delete(
      '/key-loan-maintenance-keys/loan-123'
    )

    expect(deleteSpy).toHaveBeenCalledWith('loan-123', expect.anything())
    expect(res.status).toBe(204)
    expect(res.body).toEqual({})
  })

  it('returns 500 even if loan does not exist (current behavior)', async () => {
    // Note: The current implementation doesn't check if the loan exists
    // before attempting deletion, so it returns 500 for any error including not found
    jest
      .spyOn(keyLoanMaintenanceKeysAdapter, 'deleteKeyLoanMaintenanceKey')
      .mockRejectedValueOnce(new Error('Not found'))

    const res = await request(app.callback()).delete(
      '/key-loan-maintenance-keys/nonexistent-id'
    )

    expect(res.status).toBe(500)
  })
})
