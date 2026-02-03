import * as keyEventService from '../key-event-service'
import * as keyEventsAdapter from '../adapters/key-events-adapter'
import * as keysAdapter from '../adapters/keys-adapter'
import * as factory from './factories'
import { withContext } from './testUtils'

/**
 * Tests for key-event-service
 *
 * These tests verify business logic for key event validation:
 * - Flexible key input parsing (JSON array or single string)
 * - Incomplete event conflict detection
 * - Empty array handling
 */

describe('key-event-service', () => {
  describe('parseKeysInput', () => {
    it('parses valid JSON array of key IDs', () => {
      const result = keyEventService.parseKeysInput('["key1", "key2", "key3"]')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toEqual(['key1', 'key2', 'key3'])
      }
    })

    it('parses single key ID string (non-JSON)', () => {
      const result = keyEventService.parseKeysInput('single-key-id')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toEqual(['single-key-id'])
      }
    })

    it('accepts array input directly', () => {
      const result = keyEventService.parseKeysInput(['key1', 'key2'])

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toEqual(['key1', 'key2'])
      }
    })

    it('parses JSON array with single element', () => {
      const result = keyEventService.parseKeysInput('["single-key"]')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toEqual(['single-key'])
      }
    })

    it('returns error for empty JSON array', () => {
      const result = keyEventService.parseKeysInput('[]')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.err).toBe('empty-keys-array')
      }
    })

    it('returns error for empty array input', () => {
      const result = keyEventService.parseKeysInput([])

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.err).toBe('empty-keys-array')
      }
    })

    it('treats malformed JSON as single key ID (fallback behavior)', () => {
      // Malformed JSON falls back to treating the string as a single key ID
      const result = keyEventService.parseKeysInput('["key1", "key2"')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toEqual(['["key1", "key2"'])
      }
    })

    it('returns error for non-array JSON object', () => {
      const result = keyEventService.parseKeysInput('{"key": "value"}')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.err).toBe('invalid-keys-format')
      }
    })

    it('returns error for JSON number', () => {
      const result = keyEventService.parseKeysInput('123')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.err).toBe('invalid-keys-format')
      }
    })

    it('returns error for array with non-string elements', () => {
      const result = keyEventService.parseKeysInput('[123, "key2"]')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.err).toBe('invalid-keys-format')
      }
    })

    it('returns error for empty string', () => {
      const result = keyEventService.parseKeysInput('')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.err).toBe('invalid-keys-format')
      }
    })

    it('handles whitespace in JSON', () => {
      const result = keyEventService.parseKeysInput('  ["key1"  ,  "key2"]  ')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toEqual(['key1', 'key2'])
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
          JSON.stringify([key1.id, key2.id]),
          ctx.db
        )

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.data.keyIds).toEqual([key1.id, key2.id])
        }
      }))

    it('successfully validates single key ID string', () =>
      withContext(async (ctx) => {
        const key = await keysAdapter.createKey(
          factory.key.build({ keyName: 'Test Key' }),
          ctx.db
        )

        // Pass single key ID as string (not JSON)
        const result = await keyEventService.validateKeyEventCreation(
          key.id,
          ctx.db
        )

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.data.keyIds).toEqual([key.id])
        }
      }))

    it('returns error when keys format is invalid', () =>
      withContext(async (ctx) => {
        const result = await keyEventService.validateKeyEventCreation(
          '{"not": "array"}',
          ctx.db
        )

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.err).toBe('invalid-keys-format')
        }
      }))

    it('returns error when keys array is empty', () =>
      withContext(async (ctx) => {
        const result = await keyEventService.validateKeyEventCreation(
          '[]',
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
          factory.keyEvent.build({
            keys: JSON.stringify([key.id]),
            status: 'ORDERED', // Incomplete status
          }),
          ctx.db
        )

        // Try to create another event with the same key
        const result = await keyEventService.validateKeyEventCreation(
          JSON.stringify([key.id]),
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
          factory.keyEvent.build({
            keys: JSON.stringify([key.id]),
            status: 'COMPLETED',
          }),
          ctx.db
        )

        // Should allow new event since previous is completed
        const result = await keyEventService.validateKeyEventCreation(
          JSON.stringify([key.id]),
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
          factory.keyEvent.build({
            keys: JSON.stringify([key1.id, key2.id]),
            status: 'ORDERED',
          }),
          ctx.db
        )

        // Try to create event with key2 and key3 (key2 has incomplete event)
        const result = await keyEventService.validateKeyEventCreation(
          JSON.stringify([key2.id, key3.id]),
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
          factory.keyEvent.build({
            keys: JSON.stringify([key1.id]),
            status: 'ORDERED',
          }),
          ctx.db
        )

        // Should allow event with key2 (no conflict)
        const result = await keyEventService.validateKeyEventCreation(
          JSON.stringify([key2.id]),
          ctx.db
        )

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.data.keyIds).toEqual([key2.id])
        }
      }))

    it('handles single key ID passed as non-JSON string', () =>
      withContext(async (ctx) => {
        const key = await keysAdapter.createKey(
          factory.key.build({ keyName: 'Test Key' }),
          ctx.db
        )

        // Pass key ID directly as string (common use case)
        const result = await keyEventService.validateKeyEventCreation(
          key.id,
          ctx.db
        )

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.data.keyIds).toEqual([key.id])
        }
      }))
  })
})
