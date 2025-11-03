import * as maintenanceLoansAdapter from '../../adapters/key-loan-maintenance-keys-adapter'
import * as keysAdapter from '../../adapters/keys-adapter'
import * as keyBundlesAdapter from '../../adapters/key-bundles-adapter'
import * as factory from '../factories'
import { withContext } from '../testUtils'

/**
 * Integration tests for key-loan-maintenance-keys-adapter
 *
 * These tests verify:
 * - CRUD operations on key_loan_maintenance_keys table
 * - Complex queries with key details (getKeyLoanMaintenanceKeysWithKeysByCompany/Bundle)
 * - JSON array handling for keys field
 * - Filtering by returnedAt status
 *
 * Pattern adopted from services/leasing adapter tests
 */

describe('key-loan-maintenance-keys-adapter', () => {
  describe('createKeyLoanMaintenanceKey', () => {
    it('creates a maintenance key loan in the database', () =>
      withContext(async (ctx) => {
        const loanData = {
          keys: JSON.stringify(['key-1', 'key-2']),
          company: 'ABC Construction',
          contactPerson: 'John Smith',
          description: 'Emergency repair work',
          createdAt: new Date(),
          pickedUpAt: null,
          returnedAt: null,
        }

        const loan = await maintenanceLoansAdapter.createKeyLoanMaintenanceKey(
          loanData,
          ctx.db
        )

        expect(loan.id).toBeDefined()
        expect(loan.company).toBe('ABC Construction')
        expect(loan.contactPerson).toBe('John Smith')
        expect(loan.keys).toBe(JSON.stringify(['key-1', 'key-2']))
      }))

    it('creates loan without optional fields', () =>
      withContext(async (ctx) => {
        const loan = await maintenanceLoansAdapter.createKeyLoanMaintenanceKey(
          {
            keys: JSON.stringify(['key-1']),
            company: 'XYZ Corp',
            contactPerson: 'Jane Doe',
            pickedUpAt: null,
            returnedAt: null,
          },
          ctx.db
        )

        expect(loan.description).toBeNull()
        expect(loan.pickedUpAt).toBeNull()
        expect(loan.returnedAt).toBeNull()
      }))
  })

  describe('getKeyLoanMaintenanceKeyById', () => {
    it('returns loan when it exists', () =>
      withContext(async (ctx) => {
        const created =
          await maintenanceLoansAdapter.createKeyLoanMaintenanceKey(
            factory.keyLoanMaintenanceKey.build({ company: 'Test Company' }),
            ctx.db
          )

        const loan = await maintenanceLoansAdapter.getKeyLoanMaintenanceKeyById(
          created.id,
          ctx.db
        )

        expect(loan).toBeDefined()
        expect(loan?.id).toBe(created.id)
        expect(loan?.company).toBe('Test Company')
      }))
  })

  describe('getAllKeyLoanMaintenanceKeys', () => {
    it('returns all loans ordered by id descending', () =>
      withContext(async (ctx) => {
        const loan1 = await maintenanceLoansAdapter.createKeyLoanMaintenanceKey(
          factory.keyLoanMaintenanceKey.build({ company: 'Company A' }),
          ctx.db
        )

        const loan2 = await maintenanceLoansAdapter.createKeyLoanMaintenanceKey(
          factory.keyLoanMaintenanceKey.build({ company: 'Company B' }),
          ctx.db
        )

        const loans =
          await maintenanceLoansAdapter.getAllKeyLoanMaintenanceKeys(ctx.db)

        expect(loans.length).toBeGreaterThanOrEqual(2)
        const ourLoans = loans.filter((l) =>
          [loan1.id, loan2.id].includes(l.id)
        )
        expect(ourLoans.length).toBe(2)
      }))
  })

  describe('getKeyLoanMaintenanceKeysByKeyId', () => {
    it('returns loans containing specific key', () =>
      withContext(async (ctx) => {
        const targetKeyId = 'target-maintenance-key-123'

        await maintenanceLoansAdapter.createKeyLoanMaintenanceKey(
          factory.keyLoanMaintenanceKey.build({
            keys: JSON.stringify([targetKeyId, 'other-key']),
            company: 'Company A',
          }),
          ctx.db
        )

        await maintenanceLoansAdapter.createKeyLoanMaintenanceKey(
          factory.keyLoanMaintenanceKey.build({
            keys: JSON.stringify(['different-key']),
            company: 'Company B',
          }),
          ctx.db
        )

        await maintenanceLoansAdapter.createKeyLoanMaintenanceKey(
          factory.keyLoanMaintenanceKey.build({
            keys: JSON.stringify(['another-key', targetKeyId]),
            company: 'Company C',
          }),
          ctx.db
        )

        const loans =
          await maintenanceLoansAdapter.getKeyLoanMaintenanceKeysByKeyId(
            targetKeyId,
            ctx.db
          )

        expect(loans.length).toBe(2)
        const companies = loans.map((l) => l.company)
        expect(companies).toContain('Company A')
        expect(companies).toContain('Company C')
        expect(companies).not.toContain('Company B')
      }))

    it('returns empty array when key is not in any loan', () =>
      withContext(async (ctx) => {
        await maintenanceLoansAdapter.createKeyLoanMaintenanceKey(
          factory.keyLoanMaintenanceKey.build({
            keys: JSON.stringify(['some-other-key']),
          }),
          ctx.db
        )

        const loans =
          await maintenanceLoansAdapter.getKeyLoanMaintenanceKeysByKeyId(
            'nonexistent-key',
            ctx.db
          )

        expect(loans).toEqual([])
      }))
  })

  describe('getKeyLoanMaintenanceKeysByCompany', () => {
    it('returns all loans for specific company', () =>
      withContext(async (ctx) => {
        await maintenanceLoansAdapter.createKeyLoanMaintenanceKey(
          factory.keyLoanMaintenanceKey.build({
            company: 'ABC Corp',
            contactPerson: 'Person 1',
          }),
          ctx.db
        )

        await maintenanceLoansAdapter.createKeyLoanMaintenanceKey(
          factory.keyLoanMaintenanceKey.build({
            company: 'ABC Corp',
            contactPerson: 'Person 2',
          }),
          ctx.db
        )

        await maintenanceLoansAdapter.createKeyLoanMaintenanceKey(
          factory.keyLoanMaintenanceKey.build({
            company: 'XYZ Corp',
            contactPerson: 'Person 3',
          }),
          ctx.db
        )

        const loans =
          await maintenanceLoansAdapter.getKeyLoanMaintenanceKeysByCompany(
            'ABC Corp',
            ctx.db
          )

        expect(loans.length).toBe(2)
        expect(loans.every((l) => l.company === 'ABC Corp')).toBe(true)
      }))

    it('returns empty array when company has no loans', () =>
      withContext(async (ctx) => {
        const loans =
          await maintenanceLoansAdapter.getKeyLoanMaintenanceKeysByCompany(
            'Nonexistent Company',
            ctx.db
          )

        expect(loans).toEqual([])
      }))
  })

  describe('updateKeyLoanMaintenanceKey', () => {
    it('updates loan fields successfully', () =>
      withContext(async (ctx) => {
        const loan = await maintenanceLoansAdapter.createKeyLoanMaintenanceKey(
          factory.keyLoanMaintenanceKey.build({
            company: 'Original Company',
            contactPerson: 'Original Person',
            pickedUpAt: null,
            returnedAt: null,
          }),
          ctx.db
        )

        const pickupDate = new Date()
        const updated =
          await maintenanceLoansAdapter.updateKeyLoanMaintenanceKey(
            loan.id,
            {
              contactPerson: 'Updated Person',
              pickedUpAt: pickupDate,
            },
            ctx.db
          )

        expect(updated).toBeDefined()
        expect(updated?.contactPerson).toBe('Updated Person')
        expect(updated?.pickedUpAt).toBeNearDate(pickupDate, 1000)
        expect(updated?.company).toBe('Original Company') // Unchanged
      }))

    it('returns undefined when updating non-existent loan', () =>
      withContext(async (ctx) => {
        const fakeUuid = '00000000-0000-0000-0000-000000000000'
        const result =
          await maintenanceLoansAdapter.updateKeyLoanMaintenanceKey(
            fakeUuid,
            { contactPerson: 'New Person' },
            ctx.db
          )
        expect(result).toBeUndefined()
      }))
  })

  describe('deleteKeyLoanMaintenanceKey', () => {
    it('deletes loan from database', () =>
      withContext(async (ctx) => {
        const loan = await maintenanceLoansAdapter.createKeyLoanMaintenanceKey(
          factory.keyLoanMaintenanceKey.build({ company: 'To Delete' }),
          ctx.db
        )

        const deleted =
          await maintenanceLoansAdapter.deleteKeyLoanMaintenanceKey(
            loan.id,
            ctx.db
          )

        expect(deleted).toBe(1)
      }))
  })

  describe('getKeyLoanMaintenanceKeysSearchQuery', () => {
    it('returns query builder for search operations', () =>
      withContext(async (ctx) => {
        await maintenanceLoansAdapter.createKeyLoanMaintenanceKey(
          factory.keyLoanMaintenanceKey.build({
            company: 'Searchable Company',
          }),
          ctx.db
        )

        const query =
          maintenanceLoansAdapter.getKeyLoanMaintenanceKeysSearchQuery(ctx.db)
        const loans = await query.where('company', 'like', '%Searchable%')

        expect(loans.length).toBe(1)
        expect(loans[0].company).toBe('Searchable Company')
      }))
  })

  describe('getKeyLoanMaintenanceKeysWithKeysByCompany', () => {
    it('returns loans with full key details for company', () =>
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

        // Create loan with these keys
        await maintenanceLoansAdapter.createKeyLoanMaintenanceKey(
          factory.keyLoanMaintenanceKey.build({
            keys: JSON.stringify([key1.id, key2.id]),
            company: 'Test Corp',
            returnedAt: null,
          }),
          ctx.db
        )

        const loans =
          await maintenanceLoansAdapter.getKeyLoanMaintenanceKeysWithKeysByCompany(
            'Test Corp',
            undefined,
            ctx.db
          )

        expect(loans.length).toBe(1)
        expect(loans[0].keysArray).toHaveLength(2)
        expect(loans[0].keysArray[0].keyName).toBeDefined()
        expect(loans[0].keysArray[1].keyName).toBeDefined()
      }))

    it('filters by returned status - only active loans', () =>
      withContext(async (ctx) => {
        // Create real keys first
        const key1 = await keysAdapter.createKey(
          factory.key.build({ keyName: 'Filter Key 1' }),
          ctx.db
        )
        const key2 = await keysAdapter.createKey(
          factory.key.build({ keyName: 'Filter Key 2' }),
          ctx.db
        )

        await maintenanceLoansAdapter.createKeyLoanMaintenanceKey(
          factory.keyLoanMaintenanceKey.build({
            keys: JSON.stringify([key1.id]),
            company: 'Filter Corp',
            returnedAt: null, // Active
          }),
          ctx.db
        )

        await maintenanceLoansAdapter.createKeyLoanMaintenanceKey(
          factory.keyLoanMaintenanceKey.build({
            keys: JSON.stringify([key2.id]),
            company: 'Filter Corp',
            returnedAt: new Date(), // Returned
          }),
          ctx.db
        )

        const activeLoans =
          await maintenanceLoansAdapter.getKeyLoanMaintenanceKeysWithKeysByCompany(
            'Filter Corp',
            false, // Only active
            ctx.db
          )

        expect(activeLoans.length).toBe(1)
        expect(activeLoans[0].returnedAt).toBeNull()
        expect(activeLoans[0].keysArray).toHaveLength(1)
        expect(activeLoans[0].keysArray[0].keyName).toBe('Filter Key 1')
      }))

    it('filters by returned status - only returned loans', () =>
      withContext(async (ctx) => {
        // Create real keys first
        const key1 = await keysAdapter.createKey(
          factory.key.build({ keyName: 'Return Key 1' }),
          ctx.db
        )
        const key2 = await keysAdapter.createKey(
          factory.key.build({ keyName: 'Return Key 2' }),
          ctx.db
        )

        await maintenanceLoansAdapter.createKeyLoanMaintenanceKey(
          factory.keyLoanMaintenanceKey.build({
            keys: JSON.stringify([key1.id]),
            company: 'Return Corp',
            returnedAt: null,
          }),
          ctx.db
        )

        await maintenanceLoansAdapter.createKeyLoanMaintenanceKey(
          factory.keyLoanMaintenanceKey.build({
            keys: JSON.stringify([key2.id]),
            company: 'Return Corp',
            returnedAt: new Date(),
          }),
          ctx.db
        )

        const returnedLoans =
          await maintenanceLoansAdapter.getKeyLoanMaintenanceKeysWithKeysByCompany(
            'Return Corp',
            true, // Only returned
            ctx.db
          )

        expect(returnedLoans.length).toBe(1)
        expect(returnedLoans[0].returnedAt).not.toBeNull()
        expect(returnedLoans[0].keysArray).toHaveLength(1)
        expect(returnedLoans[0].keysArray[0].keyName).toBe('Return Key 2')
      }))
  })

  describe('getKeyLoanMaintenanceKeysWithKeysByBundle', () => {
    it('returns loans containing keys from bundle', () =>
      withContext(async (ctx) => {
        // Create keys
        const key1 = await keysAdapter.createKey(
          factory.key.build({ keyName: 'Bundle Key 1' }),
          ctx.db
        )
        const key2 = await keysAdapter.createKey(
          factory.key.build({ keyName: 'Bundle Key 2' }),
          ctx.db
        )
        const key3 = await keysAdapter.createKey(
          factory.key.build({ keyName: 'Other Key' }),
          ctx.db
        )

        // Create bundle
        const bundle = await keyBundlesAdapter.createKeyBundle(
          factory.keyBundle.build({
            keys: JSON.stringify([key1.id, key2.id]),
          }),
          ctx.db
        )

        // Create loan with key from bundle
        await maintenanceLoansAdapter.createKeyLoanMaintenanceKey(
          factory.keyLoanMaintenanceKey.build({
            keys: JSON.stringify([key1.id]),
            company: 'Bundle Test',
          }),
          ctx.db
        )

        // Create loan without bundle keys
        await maintenanceLoansAdapter.createKeyLoanMaintenanceKey(
          factory.keyLoanMaintenanceKey.build({
            keys: JSON.stringify([key3.id]),
            company: 'Other Company',
          }),
          ctx.db
        )

        const loans =
          await maintenanceLoansAdapter.getKeyLoanMaintenanceKeysWithKeysByBundle(
            bundle.id,
            undefined,
            ctx.db
          )

        expect(loans.length).toBe(1)
        expect(loans[0].company).toBe('Bundle Test')
      }))

    it('returns empty array when bundle does not exist', () =>
      withContext(async (ctx) => {
        const fakeUuid = '00000000-0000-0000-0000-000000000000'
        const loans =
          await maintenanceLoansAdapter.getKeyLoanMaintenanceKeysWithKeysByBundle(
            fakeUuid,
            undefined,
            ctx.db
          )

        expect(loans).toEqual([])
      }))

    it('filters by returned status when searching by bundle', () =>
      withContext(async (ctx) => {
        const key = await keysAdapter.createKey(
          factory.key.build({ keyName: 'Test Key' }),
          ctx.db
        )

        const bundle = await keyBundlesAdapter.createKeyBundle(
          factory.keyBundle.build({
            keys: JSON.stringify([key.id]),
          }),
          ctx.db
        )

        // Create active loan
        await maintenanceLoansAdapter.createKeyLoanMaintenanceKey(
          factory.keyLoanMaintenanceKey.build({
            keys: JSON.stringify([key.id]),
            company: 'Active',
            returnedAt: null,
          }),
          ctx.db
        )

        // Create returned loan
        await maintenanceLoansAdapter.createKeyLoanMaintenanceKey(
          factory.keyLoanMaintenanceKey.build({
            keys: JSON.stringify([key.id]),
            company: 'Returned',
            returnedAt: new Date(),
          }),
          ctx.db
        )

        const activeLoans =
          await maintenanceLoansAdapter.getKeyLoanMaintenanceKeysWithKeysByBundle(
            bundle.id,
            false,
            ctx.db
          )

        expect(activeLoans.length).toBe(1)
        expect(activeLoans[0].company).toBe('Active')
      }))
  })
})
