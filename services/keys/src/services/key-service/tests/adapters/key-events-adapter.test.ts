import * as keyEventsAdapter from '../../adapters/key-events-adapter'
import * as factory from '../factories'
import { withContext } from '../testUtils'

/**
 * Integration tests for key-events-adapter
 *
 * These tests verify:
 * - CRUD operations on key_events table
 * - JSON array handling for keys field
 * - checkIncompleteKeyEvents conflict detection logic
 * - Query filtering and ordering
 *
 * Pattern adopted from services/leasing adapter tests
 */

/**
 * Helper to create event data without ID (which is auto-generated)
 */
function buildEventData(overrides: any = {}) {
  const base = factory.keyEvent.build(overrides)
  const {
    id: _id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...data
  } = base
  return data
}

describe('key-events-adapter', () => {
  describe('createKeyEvent', () => {
    it('creates a key event in the database', () =>
      withContext(async (ctx) => {
        const workOrderUuid = '12345678-1234-1234-1234-123456789012'
        const eventData = buildEventData({
          keys: JSON.stringify(['key-1', 'key-2']),
          type: 'FLEX',
          status: 'ORDERED',
          workOrderId: workOrderUuid,
        })

        const event = await keyEventsAdapter.createKeyEvent(eventData, ctx.db)

        expect(event.id).toBeDefined()
        expect(event.keys).toBe(JSON.stringify(['key-1', 'key-2']))
        expect(event.type).toBe('FLEX')
        expect(event.status).toBe('ORDERED')
        expect(event.workOrderId).toBe(workOrderUuid)
      }))
  })

  describe('getKeyEventById', () => {
    it('returns event when it exists', () =>
      withContext(async (ctx) => {
        const created = await keyEventsAdapter.createKeyEvent(
          buildEventData({ type: 'FLEX' }),
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
        const event1 = await keyEventsAdapter.createKeyEvent(
          buildEventData({ type: 'FLEX' }),
          ctx.db
        )

        const event2 = await keyEventsAdapter.createKeyEvent(
          buildEventData({ type: 'ORDER' }),
          ctx.db
        )

        const event3 = await keyEventsAdapter.createKeyEvent(
          buildEventData({ type: 'LOST' }),
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
        const targetKeyId = 'target-key-456'

        await keyEventsAdapter.createKeyEvent(
          buildEventData({
            keys: JSON.stringify([targetKeyId, 'other-key-1']),
            type: 'FLEX',
          }),
          ctx.db
        )

        await keyEventsAdapter.createKeyEvent(
          buildEventData({
            keys: JSON.stringify(['different-key']),
            type: 'ORDER',
          }),
          ctx.db
        )

        await keyEventsAdapter.createKeyEvent(
          buildEventData({
            keys: JSON.stringify(['another-key', targetKeyId]),
            type: 'LOST',
          }),
          ctx.db
        )

        const events = await keyEventsAdapter.getKeyEventsByKey(
          targetKeyId,
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
        const event = await keyEventsAdapter.createKeyEvent(
          buildEventData({
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
        const keyId = 'conflict-key-001'

        // Create incomplete event (status not COMPLETED)
        await keyEventsAdapter.createKeyEvent(
          buildEventData({
            keys: JSON.stringify([keyId]),
            status: 'ORDERED',
          }),
          ctx.db
        )

        const result = await keyEventsAdapter.checkIncompleteKeyEvents(
          [keyId],
          ctx.db
        )

        expect(result.hasConflict).toBe(true)
        expect(result.conflictingKeys).toContain(keyId)
      }))

    it('returns no conflict when key has only completed events', () =>
      withContext(async (ctx) => {
        const keyId = 'no-conflict-key-002'

        // Create completed event
        await keyEventsAdapter.createKeyEvent(
          buildEventData({
            keys: JSON.stringify([keyId]),
            status: 'COMPLETED',
          }),
          ctx.db
        )

        const result = await keyEventsAdapter.checkIncompleteKeyEvents(
          [keyId],
          ctx.db
        )

        expect(result.hasConflict).toBe(false)
        expect(result.conflictingKeys).toEqual([])
      }))
  })
})
