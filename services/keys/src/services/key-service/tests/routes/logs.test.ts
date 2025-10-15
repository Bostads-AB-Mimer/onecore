import request from 'supertest'
import Koa from 'Koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes } from '../../routes/logs'
import * as factory from '../factories'
import * as logsAdapter from '../../adapters/logs-adapter'

// Set up a Koa app with the logs routes for testing
const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

// Reset all mocks before each test
beforeEach(jest.clearAllMocks)

/**
 * Tests for GET /logs/:id endpoint
 *
 * Testing get single log:
 * - Successful retrieval
 * - Not found (404)
 * - Database errors
 */
describe('GET /logs/:id', () => {
  it('responds with 200 and log data when found', async () => {
    const mockLog = factory.log.build({
      id: 'log-123',
      userName: 'test@example.com',
      eventType: 'CREATE',
    })

    const getLogByIdSpy = jest
      .spyOn(logsAdapter, 'getLogById')
      .mockResolvedValueOnce(mockLog)

    const res = await request(app.callback()).get('/logs/log-123')

    expect(getLogByIdSpy).toHaveBeenCalledWith('log-123', expect.anything())
    expect(res.status).toBe(200)
    expect(res.body.content).toMatchObject({
      id: 'log-123',
      userName: 'test@example.com',
      eventType: 'CREATE',
    })
  })

  it('responds with 404 if log not found', async () => {
    const getLogByIdSpy = jest
      .spyOn(logsAdapter, 'getLogById')
      .mockResolvedValueOnce(undefined)

    const res = await request(app.callback()).get('/logs/nonexistent-id')

    expect(getLogByIdSpy).toHaveBeenCalledWith(
      'nonexistent-id',
      expect.anything()
    )
    expect(res.status).toBe(404)
    expect(res.body.reason).toContain('not found')
  })

  it('handles database errors and returns 500', async () => {
    jest
      .spyOn(logsAdapter, 'getLogById')
      .mockRejectedValueOnce(new Error('Database connection failed'))

    const res = await request(app.callback()).get('/logs/log-123')

    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty('error', 'Internal server error')
  })
})

/**
 * Tests for GET /logs/object/:objectId endpoint
 *
 * Testing get all logs for an objectId:
 * - Successful retrieval with multiple logs
 * - Empty results
 * - Database errors
 */
describe('GET /logs/object/:objectId', () => {
  it('returns all logs for a specific objectId', async () => {
    const mockLogs = [
      factory.log.build({
        id: 'log-1',
        objectId: 'key-abc',
        eventType: 'CREATE',
      }),
      factory.log.build({
        id: 'log-2',
        objectId: 'key-abc',
        eventType: 'UPDATE',
      }),
    ]

    const getLogsByObjectIdSpy = jest
      .spyOn(logsAdapter, 'getLogsByObjectId')
      .mockResolvedValueOnce(mockLogs)

    const res = await request(app.callback()).get('/logs/object/key-abc')

    expect(getLogsByObjectIdSpy).toHaveBeenCalledWith(
      'key-abc',
      expect.anything()
    )
    expect(res.status).toBe(200)
    expect(res.body.content).toHaveLength(2)
  })

  it('returns empty array when no logs exist for objectId', async () => {
    const getLogsByObjectIdSpy = jest
      .spyOn(logsAdapter, 'getLogsByObjectId')
      .mockResolvedValueOnce([])

    const res = await request(app.callback()).get(
      '/logs/object/nonexistent-object'
    )

    expect(getLogsByObjectIdSpy).toHaveBeenCalledWith(
      'nonexistent-object',
      expect.anything()
    )
    expect(res.status).toBe(200)
    expect(res.body.content).toHaveLength(0)
  })

  it('handles database errors and returns 500', async () => {
    jest
      .spyOn(logsAdapter, 'getLogsByObjectId')
      .mockRejectedValueOnce(new Error('Database connection failed'))

    const res = await request(app.callback()).get('/logs/object/key-abc')

    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty('error', 'Internal server error')
  })
})

/**
 * Tests for POST /logs endpoint (Create)
 *
 * Testing log creation with various scenarios:
 * - Successful creation
 * - Validation errors
 * - Database errors
 */
describe('POST /logs', () => {
  it('creates log successfully and returns 201', async () => {
    const createdLog = factory.log.build({
      id: 'new-log-123',
      userName: 'admin@example.com',
      eventType: 'creation' as any,
      objectType: 'key' as any,
      objectId: '00000000-0000-0000-0000-000000000123',
      description: 'Created new key',
    })

    const createLogSpy = jest
      .spyOn(logsAdapter, 'createLog')
      .mockResolvedValueOnce(createdLog)

    const res = await request(app.callback()).post('/logs').send({
      userName: 'admin@example.com',
      eventType: 'creation',
      objectType: 'key',
      objectId: '00000000-0000-0000-0000-000000000123',
      description: 'Created new key',
      eventTime: new Date().toISOString(),
    })

    expect(createLogSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userName: 'admin@example.com',
        eventType: 'creation',
        objectType: 'key',
        objectId: '00000000-0000-0000-0000-000000000123',
      }),
      expect.anything()
    )

    expect(res.status).toBe(201)
    expect(res.body.content).toMatchObject({
      id: 'new-log-123',
      userName: 'admin@example.com',
      eventType: 'creation',
    })
  })

  it('validates missing required fields and returns 400', async () => {
    const res = await request(app.callback()).post('/logs').send({
      eventType: 'CREATE',
      // userName is missing
    })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('status', 'error')
    expect(res.body.data).toBeDefined()
  })

  it('handles database errors and returns 500', async () => {
    jest
      .spyOn(logsAdapter, 'createLog')
      .mockRejectedValueOnce(new Error('Database connection failed'))

    const res = await request(app.callback()).post('/logs').send({
      userName: 'test@example.com',
      eventType: 'creation',
      objectType: 'key',
      objectId: '00000000-0000-0000-0000-000000000123',
      description: 'Test log',
      eventTime: new Date().toISOString(),
    })

    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty('error', 'Internal server error')
  })
})

/**
 * Tests for GET /logs endpoint (List with pagination)
 *
 * Testing list logs:
 * - Returns logs with pagination metadata
 * - Database errors
 *
 * Note: The /logs endpoint uses buildSearchQuery and pagination utilities,
 * so we test by verifying request/response behavior rather than mocking adapters.
 */
describe('GET /logs', () => {
  it('responds with 200 and list of logs with pagination', async () => {
    // Test the actual endpoint behavior
    const res = await request(app.callback()).get('/logs')

    // Should succeed with 200
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('content')
    expect(Array.isArray(res.body.content)).toBe(true)
    // Should include pagination metadata
    expect(res.body).toHaveProperty('_meta')
    expect(res.body).toHaveProperty('_links')
  })

  it('supports pagination parameters', async () => {
    // Test with page and limit parameters
    const res = await request(app.callback()).get('/logs?page=1&limit=5')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('content')
    expect(res.body._meta).toHaveProperty('limit', 5)
    expect(res.body._meta).toHaveProperty('page', 1)
  })
})

/**
 * Tests for GET /logs/search endpoint
 *
 * Testing search functionality:
 * - Missing search parameters (400)
 * - Search parameter too short (400)
 * - Valid searches
 */
describe('GET /logs/search', () => {
  it('returns 400 when no search parameters provided', async () => {
    const res = await request(app.callback()).get('/logs/search')

    expect(res.status).toBe(400)
    expect(res.body.reason).toContain(
      'At least one search parameter is required'
    )
  })

  it('returns 400 when q parameter is too short', async () => {
    const res = await request(app.callback()).get('/logs/search?q=ab')

    expect(res.status).toBe(400)
    expect(res.body.reason).toContain(
      'At least one search parameter is required'
    )
  })

  it('returns 400 when only pagination parameters provided', async () => {
    const res = await request(app.callback()).get(
      '/logs/search?page=1&limit=10'
    )

    expect(res.status).toBe(400)
    expect(res.body.reason).toContain(
      'At least one search parameter is required'
    )
  })

  it('searches by userName using OR search with q parameter', async () => {
    // Search with q parameter (OR search across default fields: objectId, userName)
    const res = await request(app.callback()).get('/logs/search?q=test')

    // Should succeed with 200
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('content')
    expect(Array.isArray(res.body.content)).toBe(true)
  })

  it('filters by eventType using AND search', async () => {
    // Search with specific field parameter (AND search)
    const res = await request(app.callback()).get(
      '/logs/search?eventType=creation'
    )

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('content')
    expect(Array.isArray(res.body.content)).toBe(true)
  })

  it('filters by objectType using AND search', async () => {
    // Test filtering by objectType field
    const res = await request(app.callback()).get('/logs/search?objectType=key')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('content')
    expect(Array.isArray(res.body.content)).toBe(true)
  })
})
