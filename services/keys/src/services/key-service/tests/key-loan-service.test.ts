import * as keyLoanService from '../key-loan-service'
import * as keyLoansAdapter from '../adapters/key-loans-adapter'
import * as keysAdapter from '../adapters/keys-adapter'
import * as factory from './factories'
import { withContext } from './testUtils'

/**
 * Tests for key-loan-service
 *
 * These tests verify business logic for key loan validation:
 * - JSON parsing and validation
 * - Active loan conflict detection
 * - Empty array handling
 * - Update vs create validation differences
 */

describe('key-loan-service', () => {
  describe('parseKeysArray', () => {
    it('parses valid JSON array of key IDs', () => {
      const result = keyLoanService.parseKeysArray('["key1", "key2", "key3"]')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toEqual(['key1', 'key2', 'key3'])
      }
    })

    it('parses array with single key', () => {
      const result = keyLoanService.parseKeysArray('["single-key"]')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toEqual(['single-key'])
      }
    })

    it('returns error for invalid JSON', () => {
      const result = keyLoanService.parseKeysArray('not-valid-json')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.err).toBe('invalid-keys-format')
      }
    })

    it('returns error for malformed JSON', () => {
      const result = keyLoanService.parseKeysArray('["key1", "key2"')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.err).toBe('invalid-keys-format')
      }
    })

    it('returns error for non-array JSON (object)', () => {
      const result = keyLoanService.parseKeysArray('{"key": "value"}')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.err).toBe('keys-not-array')
      }
    })

    it('returns error for non-array JSON (string)', () => {
      const result = keyLoanService.parseKeysArray('"just-a-string"')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.err).toBe('keys-not-array')
      }
    })

    it('returns error for non-array JSON (number)', () => {
      const result = keyLoanService.parseKeysArray('123')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.err).toBe('keys-not-array')
      }
    })

    it('returns error for empty array', () => {
      const result = keyLoanService.parseKeysArray('[]')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.err).toBe('empty-keys-array')
      }
    })

    it('returns error for array with non-string elements', () => {
      const result = keyLoanService.parseKeysArray('[123, "key2"]')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.err).toBe('invalid-keys-format')
      }
    })

    it('handles array with whitespace', () => {
      const result = keyLoanService.parseKeysArray('  ["key1"  ,  "key2"]  ')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toEqual(['key1', 'key2'])
      }
    })
  })

  describe('validateKeyLoanCreation', () => {
    it('successfully validates when no conflicts exist', () =>
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

        const result = await keyLoanService.validateKeyLoanCreation(
          JSON.stringify([key1.id, key2.id]),
          ctx.db
        )

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.data.keyIds).toEqual([key1.id, key2.id])
        }
      }))

    it('returns error when keys format is invalid', () =>
      withContext(async (ctx) => {
        const result = await keyLoanService.validateKeyLoanCreation(
          'not-valid-json',
          ctx.db
        )

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.err).toBe('invalid-keys-format')
        }
      }))

    it('returns error when keys is not an array', () =>
      withContext(async (ctx) => {
        const result = await keyLoanService.validateKeyLoanCreation(
          '{"key": "value"}',
          ctx.db
        )

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.err).toBe('keys-not-array')
        }
      }))

    it('returns error when keys array is empty', () =>
      withContext(async (ctx) => {
        const result = await keyLoanService.validateKeyLoanCreation(
          '[]',
          ctx.db
        )

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.err).toBe('empty-keys-array')
        }
      }))

    it('returns conflict error when keys have active loans', () =>
      withContext(async (ctx) => {
        // Create a key
        const key = await keysAdapter.createKey(
          factory.key.build({ keyName: 'Test Key' }),
          ctx.db
        )

        // Create an active loan with this key
        await keyLoansAdapter.createKeyLoan(
          factory.keyLoan.build({
            keys: JSON.stringify([key.id]),
            returnedAt: null, // Active loan
          }),
          ctx.db
        )

        // Try to create another loan with the same key
        const result = await keyLoanService.validateKeyLoanCreation(
          JSON.stringify([key.id]),
          ctx.db
        )

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.err).toBe('active-loan-conflict')
          expect(result.details?.conflictingKeys).toContain(key.id)
        }
      }))

    it('allows creating loan with returned keys', () =>
      withContext(async (ctx) => {
        // Create a key
        const key = await keysAdapter.createKey(
          factory.key.build({ keyName: 'Test Key' }),
          ctx.db
        )

        // Create and return a loan
        await keyLoansAdapter.createKeyLoan(
          factory.keyLoan.build({
            keys: JSON.stringify([key.id]),
            returnedAt: new Date(), // Returned loan
          }),
          ctx.db
        )

        // Should allow new loan since previous is returned
        const result = await keyLoanService.validateKeyLoanCreation(
          JSON.stringify([key.id]),
          ctx.db
        )

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.data.keyIds).toEqual([key.id])
        }
      }))

    it('identifies subset of conflicting keys in multi-key loan', () =>
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

        // Create active loan with key1 and key2
        await keyLoansAdapter.createKeyLoan(
          factory.keyLoan.build({
            keys: JSON.stringify([key1.id, key2.id]),
            returnedAt: null,
          }),
          ctx.db
        )

        // Try to create loan with key2 and key3 (key2 is conflicting)
        const result = await keyLoanService.validateKeyLoanCreation(
          JSON.stringify([key2.id, key3.id]),
          ctx.db
        )

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.err).toBe('active-loan-conflict')
          expect(result.details?.conflictingKeys).toContain(key2.id)
          expect(result.details?.conflictingKeys).not.toContain(key3.id)
        }
      }))

    it('allows loan when all requested keys are available', () =>
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

        // Create active loan with key1 only
        await keyLoansAdapter.createKeyLoan(
          factory.keyLoan.build({
            keys: JSON.stringify([key1.id]),
            returnedAt: null,
          }),
          ctx.db
        )

        // Should allow loan with key2 (not in conflict)
        const result = await keyLoanService.validateKeyLoanCreation(
          JSON.stringify([key2.id]),
          ctx.db
        )

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.data.keyIds).toEqual([key2.id])
        }
      }))
  })

  describe('validateKeyLoanUpdate', () => {
    it('allows updating own loan with same keys (idempotent)', () =>
      withContext(async (ctx) => {
        // Create a key
        const key = await keysAdapter.createKey(
          factory.key.build({ keyName: 'Test Key' }),
          ctx.db
        )

        // Create a loan
        const loan = await keyLoansAdapter.createKeyLoan(
          factory.keyLoan.build({
            keys: JSON.stringify([key.id]),
            returnedAt: null,
          }),
          ctx.db
        )

        // Update with same key should succeed
        const result = await keyLoanService.validateKeyLoanUpdate(
          loan.id,
          JSON.stringify([key.id]),
          ctx.db
        )

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.data.keyIds).toEqual([key.id])
        }
      }))

    it('prevents updating with keys from other active loans', () =>
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

        // Create two loans
        const loan1 = await keyLoansAdapter.createKeyLoan(
          factory.keyLoan.build({
            keys: JSON.stringify([key1.id]),
            returnedAt: null,
          }),
          ctx.db
        )

        await keyLoansAdapter.createKeyLoan(
          factory.keyLoan.build({
            keys: JSON.stringify([key2.id]),
            returnedAt: null,
          }),
          ctx.db
        )

        // Try to update loan1 to use key2 (already in loan2)
        const result = await keyLoanService.validateKeyLoanUpdate(
          loan1.id,
          JSON.stringify([key2.id]),
          ctx.db
        )

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.err).toBe('active-loan-conflict')
          expect(result.details?.conflictingKeys).toContain(key2.id)
        }
      }))

    it('allows adding returned keys to existing loan', () =>
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

        // Create active loan with key1
        const loan1 = await keyLoansAdapter.createKeyLoan(
          factory.keyLoan.build({
            keys: JSON.stringify([key1.id]),
            returnedAt: null,
          }),
          ctx.db
        )

        // Create returned loan with key2
        await keyLoansAdapter.createKeyLoan(
          factory.keyLoan.build({
            keys: JSON.stringify([key2.id]),
            returnedAt: new Date(),
          }),
          ctx.db
        )

        // Should allow updating loan1 to include key2 (it's been returned)
        const result = await keyLoanService.validateKeyLoanUpdate(
          loan1.id,
          JSON.stringify([key1.id, key2.id]),
          ctx.db
        )

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.data.keyIds).toEqual([key1.id, key2.id])
        }
      }))

    it('validates keys format on update', () =>
      withContext(async (ctx) => {
        const result = await keyLoanService.validateKeyLoanUpdate(
          'some-loan-id',
          'invalid-json',
          ctx.db
        )

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.err).toBe('invalid-keys-format')
        }
      }))

    it('returns error for empty keys array on update', () =>
      withContext(async (ctx) => {
        const result = await keyLoanService.validateKeyLoanUpdate(
          'some-loan-id',
          '[]',
          ctx.db
        )

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.err).toBe('empty-keys-array')
        }
      }))

    it('allows swapping keys between returned and new loan', () =>
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

        // Create loan with key1 and key2
        const loan = await keyLoansAdapter.createKeyLoan(
          factory.keyLoan.build({
            keys: JSON.stringify([key1.id, key2.id]),
            returnedAt: null,
          }),
          ctx.db
        )

        // Should allow updating to key1 and key3 (removing key2, adding key3)
        const result = await keyLoanService.validateKeyLoanUpdate(
          loan.id,
          JSON.stringify([key1.id, key3.id]),
          ctx.db
        )

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.data.keyIds).toEqual([key1.id, key3.id])
        }
      }))
  })
})
