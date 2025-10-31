import * as keyBundlesAdapter from '../../adapters/key-bundles-adapter'
import * as keysAdapter from '../../adapters/keys-adapter'
import * as maintenanceLoansAdapter from '../../adapters/key-loan-maintenance-keys-adapter'
import * as factory from '../factories'
import { withContext } from '../testUtils'

/**
 * Integration tests for key-bundles-adapter
 *
 * These tests verify:
 * - CRUD operations on key_bundles table
 * - JSON array handling for keys field
 * - Complex getKeyBundleWithLoanStatus query
 * - Search functionality
 *
 * Pattern adopted from services/leasing adapter tests
 */

describe('key-bundles-adapter', () => {
  describe('createKeyBundle', () => {
    it('creates a key bundle in the database', () =>
      withContext(async (ctx) => {
        const bundleData = factory.keyBundle.build({
          name: 'Main Building Bundle',
          description: 'Keys for main entrance',
          keys: JSON.stringify(['key-1', 'key-2', 'key-3']),
        })

        const bundle = await keyBundlesAdapter.createKeyBundle(
          bundleData,
          ctx.db
        )

        expect(bundle.id).toBeDefined()
        expect(bundle.name).toBe('Main Building Bundle')
        expect(bundle.description).toBe('Keys for main entrance')
        expect(bundle.keys).toBe(JSON.stringify(['key-1', 'key-2', 'key-3']))
      }))
  })

  describe('getKeyBundleById', () => {
    it('returns bundle when it exists', () =>
      withContext(async (ctx) => {
        const created = await keyBundlesAdapter.createKeyBundle(
          factory.keyBundle.build({ name: 'Test Bundle' }),
          ctx.db
        )

        const bundle = await keyBundlesAdapter.getKeyBundleById(
          created.id,
          ctx.db
        )

        expect(bundle).toBeDefined()
        expect(bundle?.id).toBe(created.id)
        expect(bundle?.name).toBe('Test Bundle')
      }))
  })

  describe('getAllKeyBundles', () => {
    it('returns all bundles ordered by name ascending', () =>
      withContext(async (ctx) => {
        await keyBundlesAdapter.createKeyBundle(
          factory.keyBundle.build({ name: 'Zebra Bundle' }),
          ctx.db
        )
        await keyBundlesAdapter.createKeyBundle(
          factory.keyBundle.build({ name: 'Alpha Bundle' }),
          ctx.db
        )
        await keyBundlesAdapter.createKeyBundle(
          factory.keyBundle.build({ name: 'Middle Bundle' }),
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
        const targetKeyId = 'target-key-123'

        await keyBundlesAdapter.createKeyBundle(
          factory.keyBundle.build({
            name: 'Bundle A',
            keys: JSON.stringify([targetKeyId, 'other-key-1']),
          }),
          ctx.db
        )

        await keyBundlesAdapter.createKeyBundle(
          factory.keyBundle.build({
            name: 'Bundle B',
            keys: JSON.stringify(['different-key']),
          }),
          ctx.db
        )

        await keyBundlesAdapter.createKeyBundle(
          factory.keyBundle.build({
            name: 'Bundle C',
            keys: JSON.stringify(['another-key', targetKeyId]),
          }),
          ctx.db
        )

        const bundles = await keyBundlesAdapter.getKeyBundlesByKeyId(
          targetKeyId,
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
    it('updates bundle fields successfully', () =>
      withContext(async (ctx) => {
        const bundle = await keyBundlesAdapter.createKeyBundle(
          factory.keyBundle.build({
            name: 'Original Name',
            description: 'Original Description',
            keys: JSON.stringify(['key-1']),
          }),
          ctx.db
        )

        const updated = await keyBundlesAdapter.updateKeyBundle(
          bundle.id,
          {
            name: 'Updated Name',
            description: 'Updated Description',
            keys: JSON.stringify(['key-1', 'key-2', 'key-3']),
          },
          ctx.db
        )

        expect(updated).toBeDefined()
        expect(updated?.name).toBe('Updated Name')
        expect(updated?.description).toBe('Updated Description')
        expect(updated?.keys).toBe(JSON.stringify(['key-1', 'key-2', 'key-3']))
      }))
  })

  describe('deleteKeyBundle', () => {
    it('deletes bundle from database', () =>
      withContext(async (ctx) => {
        const bundle = await keyBundlesAdapter.createKeyBundle(
          factory.keyBundle.build({ name: 'To Delete' }),
          ctx.db
        )

        const deleted = await keyBundlesAdapter.deleteKeyBundle(
          bundle.id,
          ctx.db
        )

        expect(deleted).toBe(1)
      }))
  })

  describe('getKeyBundleWithLoanStatus', () => {
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
          factory.keyBundle.build({
            name: 'Test Bundle',
            keys: JSON.stringify([key1.id, key2.id, key3.id]),
          }),
          ctx.db
        )

        // Create maintenance loan for key2
        await maintenanceLoansAdapter.createKeyLoanMaintenanceKey(
          factory.keyLoanMaintenanceKey.build({
            keys: JSON.stringify([key2.id]),
            company: 'ABC Company',
            contactPerson: 'John Doe',
            pickedUpAt: new Date(),
            returnedAt: null, // Active loan
          }),
          ctx.db
        )

        // Get bundle with loan status
        const result = await keyBundlesAdapter.getKeyBundleWithLoanStatus(
          bundle.id,
          ctx.db
        )

        expect(result.bundle.id).toBe(bundle.id)
        expect(result.keys.length).toBe(3)

        // Find key2 in results
        const key2Result = result.keys.find((k) => k.id === key2.id)
        expect(key2Result).toBeDefined()
        expect(key2Result?.maintenanceLoan).toBeDefined()
        expect(key2Result?.maintenanceLoan?.company).toBe('ABC Company')
        expect(key2Result?.maintenanceLoan?.contactPerson).toBe('John Doe')

        // Check key1 and key3 have no loan
        const key1Result = result.keys.find((k) => k.id === key1.id)
        expect(key1Result?.maintenanceLoan).toBeFalsy()

        const key3Result = result.keys.find((k) => k.id === key3.id)
        expect(key3Result?.maintenanceLoan).toBeFalsy()
      }))
  })
})
