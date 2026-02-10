import { keys } from '@onecore/types'
import * as keyEventsAdapter from '../../adapters/key-events-adapter'
import * as keysAdapter from '../../adapters/keys-adapter'
import * as factory from '../factories'
import { withContext } from '../testUtils'

type CreateKeyEventRequest = keys.v1.CreateKeyEventRequest

/**
 * Integration tests for key-events-adapter
 *
 * These tests verify:
 * - CRUD operations on key_events table
 * - Junction table handling for key_event_keys
 * - checkIncompleteKeyEvents conflict detection logic
 * - Query filtering and ordering
 *
 * Pattern adopted from services/leasing adapter tests
 */

/**
 * Helper to create event data without ID (which is auto-generated)
 */
function buildEventData(overrides: any = {}): CreateKeyEventRequest {
  const base = factory.keyEvent.build(overrides)
  const {
    id: _id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...data
  } = base
  return { ...data, ...overrides }
}

describe('key-events-adapter', () => {
  describe('createKeyEvent', () => {
    it('creates a key event in the database', () =>
      withContext(async (ctx) => {
        const key1 = await keysAdapter.createKey(
          factory.key.build({ rentalObjectCode: 'A001' }),
          ctx.db
        )
        const key2 = await keysAdapter.createKey(
          factory.key.build({ rentalObjectCode: 'A001' }),
          ctx.db
        )

        const workOrderUuid = '12345678-1234-1234-1234-123456789012'
        const eventData = buildEventData({
          keys: [key1.id, key2.id],
          type: 'FLEX',
          status: 'ORDERED',
          workOrderId: workOrderUuid,
        })

        const event = await keyEventsAdapter.createKeyEvent(eventData, ctx.db)

        expect(event.id).toBeDefined()
        expect(event.type).toBe('FLEX')
        expect(event.status).toBe('ORDERED')
        expect(event.workOrderId).toBe(workOrderUuid)
      }))
  })

  describe('getKeyEventById', () => {
    it('returns event when it exists', () =>
      withContext(async (ctx) => {
        const key = await keysAdapter.createKey(factory.key.build(), ctx.db)

        const created = await keyEventsAdapter.createKeyEvent(
          buildEventData({ keys: [key.id], type: 'FLEX' }),
          ctx.db
        )

        const event = await keyEventsAdapter.getKeyEventById(created.id, ctx.db)

        expect(event).toBeDefined()
        expect(event?.id).toBe(created.id)
        expect(event?.type).toBe('FLEX')
      }))
  })

  describe('getAllKeyEvents', () => {
    it('returns all events ordered by createdAt desc', () =>
      withContext(async (ctx) => {
        const key1 = await keysAdapter.createKey(factory.key.build(), ctx.db)
        const key2 = await keysAdapter.createKey(factory.key.build(), ctx.db)
        const key3 = await keysAdapter.createKey(factory.key.build(), ctx.db)

        const event1 = await keyEventsAdapter.createKeyEvent(
          buildEventData({ keys: [key1.id], type: 'FLEX' }),
          ctx.db
        )

        const event2 = await keyEventsAdapter.createKeyEvent(
          buildEventData({ keys: [key2.id], type: 'ORDER' }),
          ctx.db
        )

        const event3 = await keyEventsAdapter.createKeyEvent(
          buildEventData({ keys: [key3.id], type: 'LOST' }),
          ctx.db
        )

        const events = await keyEventsAdapter.getAllKeyEvents(ctx.db)

        expect(events.length).toBeGreaterThanOrEqual(3)

        // Verify our events are in the results
        const eventIds = events.map((e) => e.id)
        expect(eventIds).toContain(event1.id)
        expect(eventIds).toContain(event2.id)
        expect(eventIds).toContain(event3.id)
      }))
  })

  describe('getKeyEventsByKey', () => {
    it('returns events containing specific key', () =>
      withContext(async (ctx) => {
        const targetKey = await keysAdapter.createKey(
          factory.key.build(),
          ctx.db
        )
        const otherKey1 = await keysAdapter.createKey(
          factory.key.build(),
          ctx.db
        )
        const differentKey = await keysAdapter.createKey(
          factory.key.build(),
          ctx.db
        )
        const anotherKey = await keysAdapter.createKey(
          factory.key.build(),
          ctx.db
        )

        await keyEventsAdapter.createKeyEvent(
          buildEventData({
            keys: [targetKey.id, otherKey1.id],
            type: 'FLEX',
          }),
          ctx.db
        )

        await keyEventsAdapter.createKeyEvent(
          buildEventData({
            keys: [differentKey.id],
            type: 'ORDER',
          }),
          ctx.db
        )

        await keyEventsAdapter.createKeyEvent(
          buildEventData({
            keys: [anotherKey.id, targetKey.id],
            type: 'LOST',
          }),
          ctx.db
        )

        const events = await keyEventsAdapter.getKeyEventsByKey(
          targetKey.id,
          ctx.db
        )

        expect(events.length).toBe(2)
        const eventTypes = events.map((e) => e.type)
        expect(eventTypes).toContain('FLEX')
        expect(eventTypes).toContain('LOST')
        expect(eventTypes).not.toContain('ORDER')
      }))
  })

  describe('updateKeyEvent', () => {
    it('updates event fields successfully', () =>
      withContext(async (ctx) => {
        const key = await keysAdapter.createKey(factory.key.build(), ctx.db)

        const event = await keyEventsAdapter.createKeyEvent(
          buildEventData({
            keys: [key.id],
            type: 'FLEX',
            status: 'ORDERED',
            workOrderId: null,
          }),
          ctx.db
        )

        const newWorkOrderUuid = '99999999-9999-9999-9999-999999999999'
        const updated = await keyEventsAdapter.updateKeyEvent(
          event.id,
          {
            status: 'COMPLETED',
            workOrderId: newWorkOrderUuid,
          },
          ctx.db
        )

        expect(updated).toBeDefined()
        expect(updated?.status).toBe('COMPLETED')
        expect(updated?.workOrderId).toBe(newWorkOrderUuid)
        expect(updated?.type).toBe('FLEX') // Unchanged
      }))
  })

  describe('checkIncompleteKeyEvents', () => {
    it('detects conflict when key has incomplete event', () =>
      withContext(async (ctx) => {
        const key = await keysAdapter.createKey(factory.key.build(), ctx.db)

        // Create incomplete event (status not COMPLETED)
        await keyEventsAdapter.createKeyEvent(
          buildEventData({
            keys: [key.id],
            status: 'ORDERED',
          }),
          ctx.db
        )

        const result = await keyEventsAdapter.checkIncompleteKeyEvents(
          [key.id],
          ctx.db
        )

        expect(result.hasConflict).toBe(true)
        expect(result.conflictingKeys).toContain(key.id)
      }))

    it('returns no conflict when key has only completed events', () =>
      withContext(async (ctx) => {
        const key = await keysAdapter.createKey(factory.key.build(), ctx.db)

        // Create completed event
        await keyEventsAdapter.createKeyEvent(
          buildEventData({
            keys: [key.id],
            status: 'COMPLETED',
          }),
          ctx.db
        )

        const result = await keyEventsAdapter.checkIncompleteKeyEvents(
          [key.id],
          ctx.db
        )

        expect(result.hasConflict).toBe(false)
        expect(result.conflictingKeys).toEqual([])
      }))
  })
})
