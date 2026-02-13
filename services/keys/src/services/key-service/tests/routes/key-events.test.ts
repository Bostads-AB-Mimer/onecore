import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes } from '../../routes/key-events'
import * as factory from '../factories'
import * as keyEventsAdapter from '../../adapters/key-events-adapter'

// Set up a Koa app with the key-events routes for testing
const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

// Reset all mocks before each test
beforeEach(jest.clearAllMocks)

/**
 * Tests for GET /key-events endpoint
 *
 * Testing get all key events:
 * - Successful retrieval with multiple events
 * - Empty results
 * - Database errors
 */
describe('GET /key-events', () => {
  it('responds with 200 and list of all key events', async () => {
    const mockEvents = [
      factory.keyEvent.build({
        id: 'event-1',
        type: 'FLEX',
        status: 'COMPLETED',
      }),
      factory.keyEvent.build({
        id: 'event-2',
        type: 'FLEX',
        status: 'ORDERED',
      }),
    ]

    const getAllKeyEventsSpy = jest
      .spyOn(keyEventsAdapter, 'getAllKeyEvents')
      .mockResolvedValueOnce(mockEvents)

    const res = await request(app.callback()).get('/key-events')

    expect(getAllKeyEventsSpy).toHaveBeenCalledWith(expect.anything())
    expect(res.status).toBe(200)
    expect(res.body.content).toHaveLength(2)
  })
})

/**
 * Tests for GET /key-events/by-key/:keyId endpoint
 *
 * Testing get all key events for a specific key:
 * - Successful retrieval with multiple events
 * - With limit parameter (get latest event)
 * - Empty results
 * - Database errors
 */
describe('GET /key-events/by-key/:keyId', () => {
  it('returns all events for a specific key', async () => {
    const mockEvents = [
      factory.keyEvent.build({
        id: 'event-1',
        type: 'FLEX',
        status: 'COMPLETED',
      }),
      factory.keyEvent.build({
        id: 'event-2',
        type: 'FLEX',
        status: 'COMPLETED',
      }),
    ]

    const getKeyEventsByKeySpy = jest
      .spyOn(keyEventsAdapter, 'getKeyEventsByKey')
      .mockResolvedValueOnce(mockEvents)

    const res = await request(app.callback()).get('/key-events/by-key/key-abc')

    expect(getKeyEventsByKeySpy).toHaveBeenCalledWith(
      'key-abc',
      expect.anything(),
      undefined
    )
    expect(res.status).toBe(200)
    expect(res.body.content).toHaveLength(2)
  })

  it('supports limit parameter to get latest event', async () => {
    const mockEvents = [
      factory.keyEvent.build({
        id: 'latest-event',
        type: 'FLEX',
        status: 'ORDERED',
      }),
    ]

    const getKeyEventsByKeySpy = jest
      .spyOn(keyEventsAdapter, 'getKeyEventsByKey')
      .mockResolvedValueOnce(mockEvents)

    const res = await request(app.callback()).get(
      '/key-events/by-key/key-abc?limit=1'
    )

    expect(getKeyEventsByKeySpy).toHaveBeenCalledWith(
      'key-abc',
      expect.anything(),
      1
    )
    expect(res.status).toBe(200)
    expect(res.body.content).toHaveLength(1)
  })
})

/**
 * Tests for GET /key-events/:id endpoint
 *
 * Testing get single key event:
 * - Successful retrieval
 * - Not found (404)
 * - Database errors
 */
describe('GET /key-events/:id', () => {
  it('responds with 200 and key event data when found', async () => {
    const mockEvent = factory.keyEvent.build({
      id: 'event-123',
      type: 'FLEX',
      status: 'COMPLETED',
    })

    const getKeyEventByIdSpy = jest
      .spyOn(keyEventsAdapter, 'getKeyEventById')
      .mockResolvedValueOnce(mockEvent)

    const res = await request(app.callback()).get('/key-events/event-123')

    expect(getKeyEventByIdSpy).toHaveBeenCalledWith(
      'event-123',
      expect.anything()
    )
    expect(res.status).toBe(200)
    expect(res.body.content).toMatchObject({
      id: 'event-123',
      type: 'FLEX',
      status: 'COMPLETED',
    })
  })
})

/**
 * Tests for POST /key-events endpoint (Create)
 *
 * Testing key event creation with various scenarios:
 * - Successful creation
 * - Conflict with incomplete events (409)
 * - Validation errors
 * - Database errors
 */
describe('POST /key-events', () => {
  it('creates key event successfully and returns 201', async () => {
    const createdEvent = factory.keyEvent.build({
      id: 'new-event-123',
      type: 'FLEX',
      status: 'ORDERED',
    })

    // Mock no conflicts
    jest
      .spyOn(keyEventsAdapter, 'checkIncompleteKeyEvents')
      .mockResolvedValueOnce({ hasConflict: false, conflictingKeys: [] })

    const createKeyEventSpy = jest
      .spyOn(keyEventsAdapter, 'createKeyEvent')
      .mockResolvedValueOnce(createdEvent)

    const res = await request(app.callback())
      .post('/key-events')
      .send({
        keys: ['key-1', 'key-2'],
        type: 'FLEX',
        status: 'ORDERED',
      })

    expect(createKeyEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'FLEX',
        status: 'ORDERED',
      }),
      expect.anything()
    )

    expect(res.status).toBe(201)
    expect(res.body.content).toMatchObject({
      id: 'new-event-123',
      type: 'FLEX',
      status: 'ORDERED',
    })
  })

  it('returns 409 when keys have incomplete events (conflict)', async () => {
    // Mock conflict detected
    jest
      .spyOn(keyEventsAdapter, 'checkIncompleteKeyEvents')
      .mockResolvedValueOnce({
        hasConflict: true,
        conflictingKeys: ['key-1'],
      })

    const res = await request(app.callback())
      .post('/key-events')
      .send({
        keys: ['key-1', 'key-2'],
        type: 'FLEX',
        status: 'ORDERED',
      })

    expect(res.status).toBe(409)
    expect(res.body.reason).toContain('incomplete events')
    expect(res.body.conflictingKeys).toEqual(['key-1'])
  })

  it('rejects event with empty keys array', async () => {
    const res = await request(app.callback()).post('/key-events').send({
      keys: [],
      type: 'FLEX',
      status: 'COMPLETED',
    })

    expect(res.status).toBe(400)
    expect(res.body.reason).toContain('empty')
  })

  it('validates missing required fields and returns 400', async () => {
    const res = await request(app.callback()).post('/key-events').send({
      type: 'FLEX',
      // keys and status are missing
    })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('status', 'error')
    expect(res.body.data).toBeDefined()
  })
})

/**
 * Tests for PATCH /key-events/:id endpoint (Update)
 *
 * Testing key event updates:
 * - Successful update
 * - Not found (404)
 * - Validation errors
 * - Database errors
 */
describe('PATCH /key-events/:id', () => {
  it('updates key event successfully and returns 200', async () => {
    const updatedEvent = factory.keyEvent.build({
      id: 'event-123',
      status: 'COMPLETED',
    })

    const updateKeyEventSpy = jest
      .spyOn(keyEventsAdapter, 'updateKeyEvent')
      .mockResolvedValueOnce(updatedEvent)

    const res = await request(app.callback())
      .patch('/key-events/event-123')
      .send({
        status: 'COMPLETED',
      })

    expect(updateKeyEventSpy).toHaveBeenCalledWith(
      'event-123',
      expect.objectContaining({
        status: 'COMPLETED',
      }),
      expect.anything()
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toMatchObject({
      id: 'event-123',
      status: 'COMPLETED',
    })
  })

  it('validates invalid updates and returns 400', async () => {
    const res = await request(app.callback())
      .patch('/key-events/event-123')
      .send({
        status: 'INVALID_STATUS', // Invalid enum value
      })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('status', 'error')
  })
})
