import * as keysAdapter from '../../adapters/keys-adapter'
import * as factory from '../factories'
import { withContext } from '../testUtils'

/**
 * Integration tests for keys-adapter
 *
 * These tests use real database connections (via withContext) to verify:
 * - SQL queries execute correctly
 * - Data transformations work as expected
 * - Complex queries (joins, aggregations) return correct results
 *
 * Pattern adopted from services/leasing adapter tests
 */

describe('keys-adapter', () => {
  describe('createKey', () => {
    it('inserts a key in the database', () =>
      withContext(async (ctx) => {
        const keyData = factory.key.build({
          keyName: 'Master Key',
          keyType: 'LGH',
          rentalObjectCode: 'A001',
        })

        const key = await keysAdapter.createKey(keyData, ctx.db)

        expect(key.id).toBeDefined()
        expect(key.keyName).toBe('Master Key')
        expect(key.keyType).toBe('LGH')
      }))
  })

  describe('getKeyById', () => {
    it('returns key when it exists', () =>
      withContext(async (ctx) => {
        const createdKey = await keysAdapter.createKey(
          factory.key.build({ keyName: 'Test Key' }),
          ctx.db
        )

        const key = await keysAdapter.getKeyById(createdKey.id, ctx.db)

        expect(key).toBeDefined()
        expect(key?.id).toBe(createdKey.id)
        expect(key?.keyName).toBe('Test Key')
      }))
  })

  describe('getKeysByRentalObject', () => {
    it('returns all keys for a rental object', () =>
      withContext(async (ctx) => {
        // Create multiple keys for same rental object
        await keysAdapter.createKey(
          factory.key.build({ rentalObjectCode: 'A001', keyName: 'Key 1' }),
          ctx.db
        )
        await keysAdapter.createKey(
          factory.key.build({ rentalObjectCode: 'A001', keyName: 'Key 2' }),
          ctx.db
        )
        // Create key for different rental object
        await keysAdapter.createKey(
          factory.key.build({ rentalObjectCode: 'B002', keyName: 'Key 3' }),
          ctx.db
        )

        const keys = await keysAdapter.getKeysByRentalObject('A001', ctx.db)

        expect(keys).toHaveLength(2)
        expect(keys.map((k) => k.keyName).sort()).toEqual(['Key 1', 'Key 2'])
      }))
  })

  describe('getKeyDetailsByRentalObject', () => {
    it('returns keys with active loan information aggregated', () =>
      withContext(async (ctx) => {
        // Create key
        const key = await keysAdapter.createKey(
          factory.key.build({ rentalObjectCode: 'A001', keyName: 'Test Key' }),
          ctx.db
        )

        // Create active loan for the key
        await ctx.db('key_loans').insert({
          keys: JSON.stringify([key.id]),
          contact: 'john@example.com',
          returnedAt: null, // Active loan
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        // Test the complex aggregation query
        const result = await keysAdapter.getKeyDetailsByRentalObject('A001', ctx.db, {
          includeLoans: true,
        })

        expect(result).toHaveLength(1)
        expect(result[0].id).toBe(key.id)
        expect(result[0].loans).toBeDefined()
        expect(result[0].loans?.[0]?.contact).toBe('john@example.com')
      }))

    it('returns keys without active loans', () =>
      withContext(async (ctx) => {
        await keysAdapter.createKey(
          factory.key.build({ rentalObjectCode: 'A001' }),
          ctx.db
        )

        const result = await keysAdapter.getKeyDetailsByRentalObject('A001', ctx.db, {
          includeLoans: true,
        })

        expect(result).toHaveLength(1)
        expect(result[0].loans).toBeNull()
      }))
  })

  describe('updateKey', () => {
    it('updates key fields successfully', () =>
      withContext(async (ctx) => {
        const key = await keysAdapter.createKey(
          factory.key.build({
            keyName: 'Original Name',
            flexNumber: undefined,
          }),
          ctx.db
        )

        const updated = await keysAdapter.updateKey(
          key.id,
          { keyName: 'Updated Name', flexNumber: 123 },
          ctx.db
        )

        expect(updated).toBeDefined()
        expect(updated?.keyName).toBe('Updated Name')
        expect(updated?.flexNumber).toBe(123)
      }))

    it('returns undefined when updating non-existent key', () =>
      withContext(async (ctx) => {
        const fakeUuid = '00000000-0000-0000-0000-000000000000'
        const result = await keysAdapter.updateKey(
          fakeUuid,
          { keyName: 'New Name' },
          ctx.db
        )
        expect(result).toBeUndefined()
      }))
  })

  describe('deleteKey', () => {
    it('deletes key from database', () =>
      withContext(async (ctx) => {
        const key = await keysAdapter.createKey(factory.key.build(), ctx.db)

        const deleted = await keysAdapter.deleteKey(key.id, ctx.db)

        expect(deleted).toBe(1) // 1 row deleted
      }))
  })
})
