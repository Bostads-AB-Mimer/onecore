import * as keyBundlesAdapter from '../../adapters/key-bundles-adapter'
import * as keysAdapter from '../../adapters/keys-adapter'
import * as keyLoansAdapter from '../../adapters/key-loans-adapter'
import * as factory from '../factories'
import { withContext } from '../testUtils'

/**
 * Integration tests for key-bundles-adapter
 *
 * These tests verify:
 * - CRUD operations on key_bundles table
 * - Junction table (key_bundle_keys) handling for keys
 * - Complex getKeyBundleDetails query
 * - Search functionality
 *
 * Pattern adopted from services/leasing adapter tests
 */

describe('key-bundles-adapter', () => {
  describe('createKeyBundle', () => {
    it('creates a key bundle with keys in junction table', () =>
      withContext(async (ctx) => {
        // Create real keys for FK constraints
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

        const bundle = await keyBundlesAdapter.createKeyBundle(
          {
            name: 'Main Building Bundle',
            description: 'Keys for main entrance',
            keys: [key1.id, key2.id, key3.id],
          },
          ctx.db
        )

        expect(bundle.id).toBeDefined()
        expect(bundle.name).toBe('Main Building Bundle')
        expect(bundle.description).toBe('Keys for main entrance')

        // Verify keys are in junction table
        const junctionRows = await ctx.db('key_bundle_keys').where({
          keyBundleId: bundle.id,
        })
        expect(junctionRows).toHaveLength(3)
      }))

    it('deduplicates keys when creating', () =>
      withContext(async (ctx) => {
        const key1 = await keysAdapter.createKey(
          factory.key.build({ keyName: 'Key 1' }),
          ctx.db
        )

        const bundle = await keyBundlesAdapter.createKeyBundle(
          {
            name: 'Dedup Bundle',
            keys: [key1.id, key1.id, key1.id],
          },
          ctx.db
        )

        const junctionRows = await ctx.db('key_bundle_keys').where({
          keyBundleId: bundle.id,
        })
        expect(junctionRows).toHaveLength(1)
      }))
  })

  describe('getKeyBundleById', () => {
    it('returns bundle with keyCount when it exists', () =>
      withContext(async (ctx) => {
        const key1 = await keysAdapter.createKey(
          factory.key.build({ keyName: 'Key 1' }),
          ctx.db
        )
        const key2 = await keysAdapter.createKey(
          factory.key.build({ keyName: 'Key 2' }),
          ctx.db
        )

        const created = await keyBundlesAdapter.createKeyBundle(
          { name: 'Test Bundle', keys: [key1.id, key2.id] },
          ctx.db
        )

        const bundle = await keyBundlesAdapter.getKeyBundleById(
          created.id,
          ctx.db
        )

        expect(bundle).toBeDefined()
        expect(bundle?.id).toBe(created.id)
        expect(bundle?.name).toBe('Test Bundle')
        expect(bundle?.keyCount).toBe(2)
      }))
  })

  describe('getAllKeyBundles', () => {
    it('returns all bundles ordered by name ascending', () =>
      withContext(async (ctx) => {
        await keyBundlesAdapter.createKeyBundle(
          { name: 'Zebra Bundle', keys: [] },
          ctx.db
        )
        await keyBundlesAdapter.createKeyBundle(
          { name: 'Alpha Bundle', keys: [] },
          ctx.db
        )
        await keyBundlesAdapter.createKeyBundle(
          { name: 'Middle Bundle', keys: [] },
          ctx.db
        )

        const bundles = await keyBundlesAdapter.getAllKeyBundles(ctx.db)

        expect(bundles.length).toBeGreaterThanOrEqual(3)
        const ourBundles = bundles.filter((b) =>
          ['Zebra Bundle', 'Alpha Bundle', 'Middle Bundle'].includes(b.name)
        )
        expect(ourBundles[0].name).toBe('Alpha Bundle')
        expect(ourBundles[1].name).toBe('Middle Bundle')
        expect(ourBundles[2].name).toBe('Zebra Bundle')
      }))
  })

  describe('getKeyBundlesByKeyId', () => {
    it('returns bundles containing specific key', () =>
      withContext(async (ctx) => {
        const targetKey = await keysAdapter.createKey(
          factory.key.build({ keyName: 'Target Key' }),
          ctx.db
        )
        const otherKey1 = await keysAdapter.createKey(
          factory.key.build({ keyName: 'Other Key 1' }),
          ctx.db
        )
        const otherKey2 = await keysAdapter.createKey(
          factory.key.build({ keyName: 'Other Key 2' }),
          ctx.db
        )

        await keyBundlesAdapter.createKeyBundle(
          { name: 'Bundle A', keys: [targetKey.id, otherKey1.id] },
          ctx.db
        )

        await keyBundlesAdapter.createKeyBundle(
          { name: 'Bundle B', keys: [otherKey2.id] },
          ctx.db
        )

        await keyBundlesAdapter.createKeyBundle(
          { name: 'Bundle C', keys: [otherKey1.id, targetKey.id] },
          ctx.db
        )

        const bundles = await keyBundlesAdapter.getKeyBundlesByKeyId(
          targetKey.id,
          ctx.db
        )

        expect(bundles.length).toBe(2)
        const bundleNames = bundles.map((b) => b.name)
        expect(bundleNames).toContain('Bundle A')
        expect(bundleNames).toContain('Bundle C')
        expect(bundleNames).not.toContain('Bundle B')
      }))
  })

  describe('updateKeyBundle', () => {
    it('updates bundle fields and keys successfully', () =>
      withContext(async (ctx) => {
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

        const bundle = await keyBundlesAdapter.createKeyBundle(
          {
            name: 'Original Name',
            description: 'Original Description',
            keys: [key1.id],
          },
          ctx.db
        )

        const updated = await keyBundlesAdapter.updateKeyBundle(
          bundle.id,
          {
            name: 'Updated Name',
            description: 'Updated Description',
            keys: [key1.id, key2.id, key3.id],
          },
          ctx.db
        )

        expect(updated).toBeDefined()
        expect(updated?.name).toBe('Updated Name')
        expect(updated?.description).toBe('Updated Description')

        // Verify junction table updated
        const junctionRows = await ctx.db('key_bundle_keys').where({
          keyBundleId: bundle.id,
        })
        expect(junctionRows).toHaveLength(3)
      }))

    it('allows clearing keys with empty array', () =>
      withContext(async (ctx) => {
        const key1 = await keysAdapter.createKey(
          factory.key.build({ keyName: 'Key 1' }),
          ctx.db
        )

        const bundle = await keyBundlesAdapter.createKeyBundle(
          { name: 'Bundle', keys: [key1.id] },
          ctx.db
        )

        await keyBundlesAdapter.updateKeyBundle(
          bundle.id,
          { keys: [] },
          ctx.db
        )

        const junctionRows = await ctx.db('key_bundle_keys').where({
          keyBundleId: bundle.id,
        })
        expect(junctionRows).toHaveLength(0)
      }))
  })

  describe('deleteKeyBundle', () => {
    it('deletes bundle and cascades to junction table', () =>
      withContext(async (ctx) => {
        const key1 = await keysAdapter.createKey(
          factory.key.build({ keyName: 'Key 1' }),
          ctx.db
        )

        const bundle = await keyBundlesAdapter.createKeyBundle(
          { name: 'To Delete', keys: [key1.id] },
          ctx.db
        )

        const deleted = await keyBundlesAdapter.deleteKeyBundle(
          bundle.id,
          ctx.db
        )

        expect(deleted).toBe(1)

        // Verify junction rows were cascaded
        const junctionRows = await ctx.db('key_bundle_keys').where({
          keyBundleId: bundle.id,
        })
        expect(junctionRows).toHaveLength(0)
      }))
  })

  describe('getKeyBundleDetails', () => {
    it('returns bundle with keys and their loan status', () =>
      withContext(async (ctx) => {
        // Create real keys
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

        // Create bundle with these keys
        const bundle = await keyBundlesAdapter.createKeyBundle(
          {
            name: 'Test Bundle',
            keys: [key1.id, key2.id, key3.id],
          },
          ctx.db
        )

        // Create maintenance loan for key2
        await keyLoansAdapter.createKeyLoan(
          {
            ...factory.keyLoanMaintenanceKey.build({
              contact: 'ABC Company',
              contactPerson: 'John Doe',
              pickedUpAt: new Date(),
              returnedAt: null, // Active loan
            }),
            keys: [key2.id],
          },
          ctx.db
        )

        // Get bundle with loan status
        const result = await keyBundlesAdapter.getKeyBundleDetails(
          bundle.id,
          { includeLoans: true },
          ctx.db
        )

        expect(result.bundle.id).toBe(bundle.id)
        expect(result.keys.length).toBe(3)

        // Find key2 in results
        const key2Result = result.keys.find((k) => k.id === key2.id)
        expect(key2Result).toBeDefined()
        expect(key2Result?.loans).toBeDefined()
        expect(key2Result?.loans?.[0]?.loanType).toBe('MAINTENANCE')
        expect(key2Result?.loans?.[0]?.contact).toBe('ABC Company')
        expect(key2Result?.loans?.[0]?.contactPerson).toBe('John Doe')

        // Check key1 and key3 have no loan
        const key1Result = result.keys.find((k) => k.id === key1.id)
        expect(key1Result?.loans).toBeFalsy()

        const key3Result = result.keys.find((k) => k.id === key3.id)
        expect(key3Result?.loans).toBeFalsy()
      }))
  })
})
