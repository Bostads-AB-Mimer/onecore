import { keys } from '@onecore/types'
import * as keyEventService from '../key-event-service'
import * as keyEventsAdapter from '../adapters/key-events-adapter'
import * as keysAdapter from '../adapters/keys-adapter'
import * as factory from './factories'
import { withContext } from './testUtils'

type CreateKeyEventRequest = keys.v1.CreateKeyEventRequest

/**
 * Tests for key-event-service
 *
 * These tests verify business logic for key event validation:
 * - Array validation
 * - Incomplete event conflict detection
 * - Empty array handling
 */

describe('key-event-service', () => {
  describe('parseKeysInput', () => {
    it('accepts valid array of key IDs', () => {
      const result = keyEventService.parseKeysInput(['key1', 'key2', 'key3'])

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toEqual(['key1', 'key2', 'key3'])
      }
    })

    it('accepts array with single key', () => {
      const result = keyEventService.parseKeysInput(['single-key'])

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toEqual(['single-key'])
      }
    })

    it('returns error for empty array', () => {
      const result = keyEventService.parseKeysInput([])

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.err).toBe('empty-keys-array')
      }
    })
  })

  describe('validateKeyEventCreation', () => {
    it('successfully validates when no incomplete events exist', () =>
      withContext(async (ctx) => {
        // Create some keys
        const key1 = await keysAdapter.createKey(
          factory.key.build({ keyName: 'Key 1' }),
          ctx.db
        )
        const key2 = await keysAdapter.createKey(
          factory.key.build({ keyName: 'Key 2' }),
          ctx.db
        )

        const result = await keyEventService.validateKeyEventCreation(
          [key1.id, key2.id],
          ctx.db
        )

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.data.keyIds).toEqual([key1.id, key2.id])
        }
      }))

    it('successfully validates single key ID in array', () =>
      withContext(async (ctx) => {
        const key = await keysAdapter.createKey(
          factory.key.build({ keyName: 'Test Key' }),
          ctx.db
        )

        const result = await keyEventService.validateKeyEventCreation(
          [key.id],
          ctx.db
        )

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.data.keyIds).toEqual([key.id])
        }
      }))

    it('returns error when keys array is empty', () =>
      withContext(async (ctx) => {
        const result = await keyEventService.validateKeyEventCreation(
          [],
          ctx.db
        )

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.err).toBe('empty-keys-array')
        }
      }))

    it('returns conflict error when keys have incomplete events', () =>
      withContext(async (ctx) => {
        // Create a key
        const key = await keysAdapter.createKey(
          factory.key.build({ keyName: 'Test Key' }),
          ctx.db
        )

        // Create an incomplete event for this key
        await keyEventsAdapter.createKeyEvent(
          {
            ...factory.keyEvent.build({ status: 'ORDERED' }),
            keys: [key.id],
          } as CreateKeyEventRequest,
          ctx.db
        )

        // Try to create another event with the same key
        const result = await keyEventService.validateKeyEventCreation(
          [key.id],
          ctx.db
        )

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.err).toBe('incomplete-event-conflict')
          expect(result.details?.conflictingKeys).toContain(key.id)
        }
      }))

    it('allows creating event when previous events are completed', () =>
      withContext(async (ctx) => {
        // Create a key
        const key = await keysAdapter.createKey(
          factory.key.build({ keyName: 'Test Key' }),
          ctx.db
        )

        // Create a completed event
        await keyEventsAdapter.createKeyEvent(
          {
            ...factory.keyEvent.build({ status: 'COMPLETED' }),
            keys: [key.id],
          } as CreateKeyEventRequest,
          ctx.db
        )

        // Should allow new event since previous is completed
        const result = await keyEventService.validateKeyEventCreation(
          [key.id],
          ctx.db
        )

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.data.keyIds).toEqual([key.id])
        }
      }))

    it('identifies subset of conflicting keys in multi-key event', () =>
      withContext(async (ctx) => {
        // Create three keys
        const key1 = await keysAdapter.createKey(
          factory.key.build({ keyName: 'Key 1' }),
          ctx.db
        )
        const key2 = await keysAdapter.createKey(
          factory.key.build({ keyName: 'Key 2' }),
          ctx.db
        )
        const key3 = await keysAdapter.createKey(
          factory.key.build({ keyName: 'Key 3' }),
          ctx.db
        )

        // Create incomplete event with key1 and key2
        await keyEventsAdapter.createKeyEvent(
          {
            ...factory.keyEvent.build({ status: 'ORDERED' }),
            keys: [key1.id, key2.id],
          } as CreateKeyEventRequest,
          ctx.db
        )

        // Try to create event with key2 and key3 (key2 has incomplete event)
        const result = await keyEventService.validateKeyEventCreation(
          [key2.id, key3.id],
          ctx.db
        )

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.err).toBe('incomplete-event-conflict')
          expect(result.details?.conflictingKeys).toContain(key2.id)
          expect(result.details?.conflictingKeys).not.toContain(key3.id)
        }
      }))

    it('allows event when all requested keys are available', () =>
      withContext(async (ctx) => {
        // Create two keys
        const key1 = await keysAdapter.createKey(
          factory.key.build({ keyName: 'Key 1' }),
          ctx.db
        )
        const key2 = await keysAdapter.createKey(
          factory.key.build({ keyName: 'Key 2' }),
          ctx.db
        )

        // Create incomplete event with key1 only
        await keyEventsAdapter.createKeyEvent(
          {
            ...factory.keyEvent.build({ status: 'ORDERED' }),
            keys: [key1.id],
          } as CreateKeyEventRequest,
          ctx.db
        )

        // Should allow event with key2 (no conflict)
        const result = await keyEventService.validateKeyEventCreation(
          [key2.id],
          ctx.db
        )

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.data.keyIds).toEqual([key2.id])
        }
      }))

    it('handles single key ID in array', () =>
      withContext(async (ctx) => {
        const key = await keysAdapter.createKey(
          factory.key.build({ keyName: 'Test Key' }),
          ctx.db
        )

        // Pass key ID in array
        const result = await keyEventService.validateKeyEventCreation(
          [key.id],
          ctx.db
        )

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.data.keyIds).toEqual([key.id])
        }
      }))
  })
})
