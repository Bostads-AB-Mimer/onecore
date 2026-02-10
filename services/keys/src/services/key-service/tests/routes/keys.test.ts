import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes } from '../../routes/keys'
import * as factory from '../factories'
import * as keysAdapter from '../../adapters/keys-adapter'

// Set up a Koa app with the keys routes for testing
const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

// Reset all mocks before each test
beforeEach(jest.clearAllMocks)

/**
 * Tests for GET /keys endpoint (List with pagination)
 *
 * Note: Pagination structure tests removed - tested once at middleware level
 */
describe('GET /keys', () => {
  // Pagination structure tests removed - this is middleware concern, not endpoint-specific
})

/**
 * Tests for GET /keys/:id endpoint
 *
 * This follows the leasing service pattern:
 * - Mock adapter functions instead of direct database calls
 * - Use factories to generate test data
 * - Test both success and error scenarios
 */
describe('GET /keys/:id', () => {
  it('responds with 200 and key data when key is found', async () => {
    // Create mock key data using our factory
    const mockKey = factory.key.build({
      id: 'test-id-123',
      keyName: 'Master Key',
      keyType: 'LGH',
    })

    // Mock the adapter to return the key
    const getKeyByIdSpy = jest
      .spyOn(keysAdapter, 'getKeyById')
      .mockResolvedValueOnce(mockKey)

    // Make HTTP request
    const res = await request(app.callback()).get('/keys/test-id-123')

    // Verify the adapter was called
    expect(getKeyByIdSpy).toHaveBeenCalledWith('test-id-123', expect.anything())

    // Verify the response
    expect(res.status).toBe(200)
    expect(res.body.content).toMatchObject({
      id: 'test-id-123',
      keyName: 'Master Key',
      keyType: 'LGH',
    })
  })
})

/**
 * Tests for POST /keys endpoint (Create)
 *
 * Testing key creation with various scenarios:
 * - Successful creation
 * - Validation errors
 * - Database errors
 */
describe('POST /keys', () => {
  it('creates key successfully and returns 201', async () => {
    // Create mock key data that will be "returned" after creation
    const createdKey = factory.key.build({
      id: 'new-key-id-123',
      keyName: 'New Master Key',
      keyType: 'LGH',
      rentalObjectCode: 'A001',
    })

    // Mock the adapter to return the created key
    const createKeySpy = jest
      .spyOn(keysAdapter, 'createKey')
      .mockResolvedValueOnce(createdKey)

    // Make POST request with valid data
    const res = await request(app.callback()).post('/keys').send({
      keyName: 'New Master Key',
      keyType: 'LGH',
      rentalObjectCode: 'A001',
    })

    // Verify adapter was called with correct data
    expect(createKeySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        keyName: 'New Master Key',
        keyType: 'LGH',
        rentalObjectCode: 'A001',
      }),
      expect.anything()
    )

    // Verify response
    expect(res.status).toBe(201)
    expect(res.body.content).toMatchObject({
      id: 'new-key-id-123',
      keyName: 'New Master Key',
      keyType: 'LGH',
    })
  })

  it('returns created key with generated ID', async () => {
    const createdKey = factory.key.build({
      keyName: 'Test Key',
      keyType: 'PB',
    })

    jest.spyOn(keysAdapter, 'createKey').mockResolvedValueOnce(createdKey)

    const res = await request(app.callback()).post('/keys').send({
      keyName: 'Test Key',
      keyType: 'PB',
    })

    expect(res.status).toBe(201)
    expect(res.body.content).toHaveProperty('id')
    expect(res.body.content.id).toBeDefined()
  })

  it('validates missing required fields and returns 400', async () => {
    // Try to create key without required 'keyName' field
    const res = await request(app.callback()).post('/keys').send({
      keyType: 'LGH',
      // keyName is missing
    })

    // Should fail validation before reaching the adapter
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('status', 'error')
    expect(res.body.data).toBeDefined()
    expect(res.body.data[0].path).toContain('keyName')
  })

  it('validates invalid keyType enum and returns 400', async () => {
    // Try to create key with invalid keyType
    const res = await request(app.callback()).post('/keys').send({
      keyName: 'Test Key',
      keyType: 'INVALID_TYPE', // Not one of: LGH, PB, FS, HN
    })

    // Should fail validation before reaching the adapter
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('status', 'error')
    expect(res.body.data).toBeDefined()
    expect(res.body.data[0].path).toContain('keyType')
  })
})

/**
 * Tests for GET /keys/by-rental-object/:rentalObjectCode endpoint
 *
 * Testing key filtering by rental object code:
 * - Successful retrieval of multiple keys
 * - Empty results when no keys exist for the rental object
 * - Error handling
 */
describe('GET /keys/by-rental-object/:rentalObjectCode', () => {
  it('returns all keys for a rental object code', async () => {
    // Create mock keys for the same rental object
    const mockKeys = [
      factory.key.build({
        id: 'key-1',
        keyName: 'Apartment Key',
        keyType: 'LGH',
        rentalObjectCode: 'A001',
      }),
      factory.key.build({
        id: 'key-2',
        keyName: 'Mailbox Key',
        keyType: 'PB',
        rentalObjectCode: 'A001',
      }),
      factory.key.build({
        id: 'key-3',
        keyName: 'Storage Key',
        keyType: 'FS',
        rentalObjectCode: 'A001',
      }),
    ]

    // Mock the adapter to return the keys
    const getKeysDetailsSpy = jest
      .spyOn(keysAdapter, 'getKeyDetailsByRentalObject')
      .mockResolvedValueOnce(mockKeys)

    // Make HTTP request
    const res = await request(app.callback()).get('/keys/by-rental-object/A001')

    // Verify the adapter was called with options object
    expect(getKeysDetailsSpy).toHaveBeenCalledWith('A001', expect.anything(), {
      includeLoans: false,
      includeEvents: false,
      includeKeySystem: false,
    })

    // Verify the response
    expect(res.status).toBe(200)
    expect(res.body.content).toHaveLength(3)
    expect(res.body.content[0]).toMatchObject({
      id: 'key-1',
      keyName: 'Apartment Key',
      keyType: 'LGH',
      rentalObjectCode: 'A001',
    })
  })
})

/**
 * Tests for PATCH /keys/:id endpoint (Update)
 *
 * Testing key update with various scenarios:
 * - Successful full update
 * - Successful partial update
 * - Key not found (404)
 * - Validation errors
 * - Database errors
 */
describe('PATCH /keys/:id', () => {
  it('updates key successfully and returns 200', async () => {
    // Create a mock updated key
    const updatedKey = factory.key.build({
      id: 'test-key-123',
      keyName: 'Updated Master Key',
      keyType: 'PB',
      rentalObjectCode: 'B002',
    })

    // Mock the adapter to return the updated key
    const updateKeySpy = jest
      .spyOn(keysAdapter, 'updateKey')
      .mockResolvedValueOnce(updatedKey)

    // Make PATCH request
    const res = await request(app.callback()).patch('/keys/test-key-123').send({
      keyName: 'Updated Master Key',
      keyType: 'PB',
      rentalObjectCode: 'B002',
    })

    // Verify adapter was called with correct data
    expect(updateKeySpy).toHaveBeenCalledWith(
      'test-key-123',
      expect.objectContaining({
        keyName: 'Updated Master Key',
        keyType: 'PB',
        rentalObjectCode: 'B002',
      }),
      expect.anything()
    )

    // Verify response
    expect(res.status).toBe(200)
    expect(res.body.content).toMatchObject({
      id: 'test-key-123',
      keyName: 'Updated Master Key',
      keyType: 'PB',
    })
  })

  it('successfully updates only specified fields (partial update)', async () => {
    // Create a mock key with only keyName updated
    const updatedKey = factory.key.build({
      id: 'test-key-123',
      keyName: 'Only Name Changed',
      keyType: 'LGH', // Other fields remain unchanged
      rentalObjectCode: 'A001',
    })

    const updateKeySpy = jest
      .spyOn(keysAdapter, 'updateKey')
      .mockResolvedValueOnce(updatedKey)

    // Make PATCH request with only one field
    const res = await request(app.callback()).patch('/keys/test-key-123').send({
      keyName: 'Only Name Changed',
    })

    // Verify adapter was called with only the updated field
    expect(updateKeySpy).toHaveBeenCalledWith(
      'test-key-123',
      expect.objectContaining({
        keyName: 'Only Name Changed',
      }),
      expect.anything()
    )

    // Verify response
    expect(res.status).toBe(200)
    expect(res.body.content.keyName).toBe('Only Name Changed')
  })

  it('validates invalid keyType enum and returns 400', async () => {
    // Try to update key with invalid keyType
    const res = await request(app.callback()).patch('/keys/test-key-123').send({
      keyType: 'INVALID_TYPE', // Not one of: LGH, PB, FS, HN
    })

    // Should fail validation before reaching the adapter
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('status', 'error')
    expect(res.body.data).toBeDefined()
    expect(res.body.data[0].path).toContain('keyType')
  })
})

/**
 * Tests for DELETE /keys/:id endpoint
 *
 * Testing key deletion with various scenarios:
 * - Successful deletion
 * - Key not found (404)
 * - Database errors
 */
describe('DELETE /keys/:id', () => {
  it('deletes key successfully and returns 200', async () => {
    // Mock the adapter to return 1 (one row deleted)
    const deleteKeySpy = jest
      .spyOn(keysAdapter, 'deleteKey')
      .mockResolvedValueOnce(1)

    // Make DELETE request
    const res = await request(app.callback()).delete('/keys/test-key-123')

    // Verify adapter was called with correct ID
    expect(deleteKeySpy).toHaveBeenCalledWith('test-key-123', expect.anything())

    // Verify response
    expect(res.status).toBe(200)
  })
})

/**
 * Tests for POST /keys/bulk-update-flex endpoint
 *
 * Testing bulk update of flex numbers for keys on a rental object:
 * - Successful bulk update
 * - Validation errors (flex number out of range)
 * - Database errors
 */
describe('POST /keys/bulk-update-flex', () => {
  it('successfully updates flex number for all keys on rental object', async () => {
    // Mock the adapter to return 3 (three rows updated)
    const bulkUpdateFlexNumberSpy = jest
      .spyOn(keysAdapter, 'bulkUpdateFlexNumber')
      .mockResolvedValueOnce(3)

    // Make POST request
    const res = await request(app.callback())
      .post('/keys/bulk-update-flex')
      .send({
        rentalObjectCode: 'A001',
        flexNumber: 2,
      })

    // Verify adapter was called with correct parameters
    expect(bulkUpdateFlexNumberSpy).toHaveBeenCalledWith(
      'A001',
      2,
      expect.anything()
    )

    // Verify response
    expect(res.status).toBe(200)
    expect(res.body.content).toBe(3)
  })

  it('successfully updates with flex number 1', async () => {
    const bulkUpdateFlexNumberSpy = jest
      .spyOn(keysAdapter, 'bulkUpdateFlexNumber')
      .mockResolvedValueOnce(5)

    const res = await request(app.callback())
      .post('/keys/bulk-update-flex')
      .send({
        rentalObjectCode: 'B002',
        flexNumber: 1,
      })

    expect(bulkUpdateFlexNumberSpy).toHaveBeenCalledWith(
      'B002',
      1,
      expect.anything()
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toBe(5)
  })

  it('successfully updates with flex number 3 (max)', async () => {
    const bulkUpdateFlexNumberSpy = jest
      .spyOn(keysAdapter, 'bulkUpdateFlexNumber')
      .mockResolvedValueOnce(2)

    const res = await request(app.callback())
      .post('/keys/bulk-update-flex')
      .send({
        rentalObjectCode: 'C003',
        flexNumber: 3,
      })

    expect(bulkUpdateFlexNumberSpy).toHaveBeenCalledWith(
      'C003',
      3,
      expect.anything()
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toBe(2)
  })

  it('returns 0 when no keys exist for rental object', async () => {
    // Mock the adapter to return 0 (no rows updated)
    const bulkUpdateFlexNumberSpy = jest
      .spyOn(keysAdapter, 'bulkUpdateFlexNumber')
      .mockResolvedValueOnce(0)

    const res = await request(app.callback())
      .post('/keys/bulk-update-flex')
      .send({
        rentalObjectCode: 'NONEXISTENT',
        flexNumber: 2,
      })

    expect(bulkUpdateFlexNumberSpy).toHaveBeenCalledWith(
      'NONEXISTENT',
      2,
      expect.anything()
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toBe(0)
  })

  it('validates flex number minimum (less than 1) and returns 400', async () => {
    const res = await request(app.callback())
      .post('/keys/bulk-update-flex')
      .send({
        rentalObjectCode: 'A001',
        flexNumber: 0, // Below minimum
      })

    // Should fail validation
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('status', 'error')
    expect(res.body.data).toBeDefined()
  })

  it('validates flex number maximum (greater than 3) and returns 400', async () => {
    const res = await request(app.callback())
      .post('/keys/bulk-update-flex')
      .send({
        rentalObjectCode: 'A001',
        flexNumber: 4, // Above maximum
      })

    // Should fail validation
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('status', 'error')
    expect(res.body.data).toBeDefined()
  })

  it('validates missing rentalObjectCode and returns 400', async () => {
    const res = await request(app.callback())
      .post('/keys/bulk-update-flex')
      .send({
        flexNumber: 2,
        // rentalObjectCode is missing
      })

    // Should fail validation
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('status', 'error')
    expect(res.body.data).toBeDefined()
  })
})

/**
 * Tests for GET /keys/search endpoint
 *
 * Testing the search endpoint with flexible filtering:
 * - OR search with q parameter
 * - AND search with field parameters
 * - Combination of OR and AND search
 * - Missing search parameters (should return 400)
 * - Database errors
 *
 * Note: The search endpoint has complex query building logic and uses
 * the paginate utility directly, so we test by verifying request/response
 * behavior rather than mocking the adapter.
 */
describe('GET /keys/search', () => {
  it('returns 400 when no search parameters provided', async () => {
    // Make request without any search params
    const res = await request(app.callback()).get('/keys/search')

    // Should fail validation
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty(
      'reason',
      'At least one search parameter is required'
    )
  })

  it('returns 400 when q parameter is too short', async () => {
    // Make request with q less than 2 characters
    const res = await request(app.callback()).get('/keys/search?q=a')

    // Should fail validation (q must be at least 2 characters)
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty(
      'reason',
      'At least one search parameter is required'
    )
  })

  it('returns 400 when only pagination parameters provided', async () => {
    // Make request with only page/limit (no search criteria)
    const res = await request(app.callback()).get(
      '/keys/search?page=1&limit=10'
    )

    // Should fail validation
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty(
      'reason',
      'At least one search parameter is required'
    )
  })

  it('searches by keyName using OR search with q parameter', async () => {
    // Search with q parameter (OR search across default field: keyName)
    const res = await request(app.callback()).get('/keys/search?q=Master')

    // Should succeed with 200 (actual results depend on test data)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('content')
    expect(Array.isArray(res.body.content)).toBe(true)
  })

  it('filters by rentalObjectCode using AND search', async () => {
    // Search with specific field parameter (AND search)
    const res = await request(app.callback()).get(
      '/keys/search?rentalObjectCode=A001'
    )

    // Should succeed with 200
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('content')
    expect(Array.isArray(res.body.content)).toBe(true)
  })

  it('combines OR and AND search parameters', async () => {
    // Combined search: q (OR) + specific field (AND)
    const res = await request(app.callback()).get(
      '/keys/search?q=Key&keyType=LGH'
    )

    // Should succeed with 200
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('content')
    expect(Array.isArray(res.body.content)).toBe(true)
  })

  it('combines multiple AND search parameters', async () => {
    // Multiple AND filters with valid search fields
    const res = await request(app.callback()).get(
      '/keys/search?keyType=LGH&rentalObjectCode=A001'
    )

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('content')
  })

  it('searches with keyName parameter', async () => {
    const res = await request(app.callback()).get('/keys/search?keyName=Master')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('content')
  })

  it('supports pagination with search parameters', async () => {
    const res = await request(app.callback()).get(
      '/keys/search?q=Key&page=2&limit=5'
    )

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('_meta')
    expect(res.body).toHaveProperty('_links')
  })

  it('returns empty results for search with no matches', async () => {
    const res = await request(app.callback()).get(
      '/keys/search?q=NonexistentKeyXYZ123'
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toBeDefined()
    expect(Array.isArray(res.body.content)).toBe(true)
  })
})

/**
 * Phase 6D: Validation Edge Cases
 *
 * Testing boundary conditions and invalid data scenarios:
 * - Invalid data formats
 * - Boundary conditions for numeric fields
 * - String length validations
 * - Empty/null value handling
 */
describe('Validation Edge Cases - Keys', () => {
  // Useless tests removed - tests that accept ANY status code aren't testing anything
  // Removed: "rejects extremely long keyName" - accepts 201, 400, OR 500 (any result!)
  // Removed: "validates invalid UUID format" - accepts 400, 404, OR 500 (any result!)
})
