import * as keyLoansAdapter from '../../adapters/key-loans-adapter'
import * as keysAdapter from '../../adapters/keys-adapter'
import * as factory from '../factories'
import { withContext } from '../testUtils'

/**
 * Integration tests for key-loans-adapter
 *
 * These tests verify complex business logic including:
 * - Active loan conflict detection
 * - Junction table key/card associations
 * - Multi-table aggregation queries
 * - Transaction-safe operations
 *
 * Pattern adopted from services/leasing adapter tests
 */

describe('key-loans-adapter', () => {
  describe('createKeyLoan', () => {
    it('creates a key loan with keys array', () =>
      withContext(async (ctx) => {
        const key1 = await keysAdapter.createKey(
          factory.key.build({ rentalObjectCode: 'A001' }),
          ctx.db
        )
        const key2 = await keysAdapter.createKey(
          factory.key.build({ rentalObjectCode: 'A001' }),
          ctx.db
        )

        const loanData = {
          keys: [key1.id, key2.id],
          loanType: 'TENANT' as const,
          contact: 'john@example.com',
        }

        const loan = await keyLoansAdapter.createKeyLoan(loanData, ctx.db)

        expect(loan.id).toBeDefined()
        expect(loan.contact).toBe('john@example.com')
        expect(loan.returnedAt).toBeNull()
        expect(loan.pickedUpAt).toBeNull()
      }))
  })

  describe('getKeyLoanById', () => {
    it('returns loan when it exists', () =>
      withContext(async (ctx) => {
        const key = await keysAdapter.createKey(factory.key.build(), ctx.db)
        const createdLoan = await keyLoansAdapter.createKeyLoan(
          {
            keys: [key.id],
            loanType: 'TENANT' as const,
            contact: 'test@example.com',
          },
          ctx.db
        )

        const loan = await keyLoansAdapter.getKeyLoanById(
          createdLoan.id,
          ctx.db
        )

        expect(loan).toBeDefined()
        expect(loan?.id).toBe(createdLoan.id)
        expect(loan?.contact).toBe('test@example.com')
      }))
  })

  describe('checkActiveKeyLoans', () => {
    it('detects conflict when key has active loan', () =>
      withContext(async (ctx) => {
        const key = await keysAdapter.createKey(factory.key.build(), ctx.db)

        // Create loan and activate it (must set pickedUpAt)
        const loan = await keyLoansAdapter.createKeyLoan(
          {
            keys: [key.id],
            loanType: 'TENANT' as const,
            contact: 'existing@example.com',
          },
          ctx.db
        )

        // Activate the loan - only loans with pickedUpAt are considered active
        await keyLoansAdapter.updateKeyLoan(
          loan.id,
          { pickedUpAt: new Date() },
          ctx.db
        )

        const result = await keyLoansAdapter.checkActiveKeyLoans(
          [key.id],
          undefined,
          ctx.db
        )

        expect(result.hasConflict).toBe(true)
        expect(result.conflictingKeys).toContain(key.id)
      }))

    it('ignores returned loans when checking conflicts', () =>
      withContext(async (ctx) => {
        const key = await keysAdapter.createKey(factory.key.build(), ctx.db)

        const loan = await keyLoansAdapter.createKeyLoan(
          {
            keys: [key.id],
            loanType: 'TENANT' as const,
            contact: 'test@example.com',
          },
          ctx.db
        )

        // Return the loan
        await keyLoansAdapter.updateKeyLoan(
          loan.id,
          { returnedAt: new Date() },
          ctx.db
        )

        // Check if key conflicts (should NOT conflict with returned loan)
        const result = await keyLoansAdapter.checkActiveKeyLoans(
          [key.id],
          undefined,
          ctx.db
        )

        expect(result.hasConflict).toBe(false)
      }))
  })

  describe('updateKeyLoan', () => {
    it('updates loan fields successfully', () =>
      withContext(async (ctx) => {
        const key = await keysAdapter.createKey(factory.key.build(), ctx.db)
        const loan = await keyLoansAdapter.createKeyLoan(
          {
            keys: [key.id],
            loanType: 'TENANT' as const,
            contact: 'original@example.com',
          },
          ctx.db
        )

        const pickupDate = new Date()
        const updated = await keyLoansAdapter.updateKeyLoan(
          loan.id,
          {
            contact: 'updated@example.com',
            pickedUpAt: pickupDate,
          },
          ctx.db
        )

        expect(updated).toBeDefined()
        expect(updated?.contact).toBe('updated@example.com')
        expect(updated?.pickedUpAt).toBeNearDate(pickupDate, 1000)
      }))
  })

  describe('getKeyLoansByRentalObject', () => {
    it('returns all loans for a rental object', () =>
      withContext(async (ctx) => {
        const key1 = await keysAdapter.createKey(
          factory.key.build({ rentalObjectCode: 'A001' }),
          ctx.db
        )
        const key2 = await keysAdapter.createKey(
          factory.key.build({ rentalObjectCode: 'B002' }),
          ctx.db
        )

        await keyLoansAdapter.createKeyLoan(
          {
            keys: [key1.id],
            loanType: 'TENANT' as const,
            contact: 'tenant1@example.com',
          },
          ctx.db
        )
        await keyLoansAdapter.createKeyLoan(
          {
            keys: [key2.id],
            loanType: 'TENANT' as const,
            contact: 'tenant2@example.com',
          },
          ctx.db
        )

        const loans = await keyLoansAdapter.getKeyLoansByRentalObject(
          'A001',
          undefined,
          undefined,
          false,
          undefined, // returned
          ctx.db
        )

        expect(loans).toHaveLength(1)
        expect(loans[0].contact).toBe('tenant1@example.com')
      }))
  })

  describe('deleteKeyLoan', () => {
    it('deletes loan from database', () =>
      withContext(async (ctx) => {
        const key = await keysAdapter.createKey(factory.key.build(), ctx.db)
        const loan = await keyLoansAdapter.createKeyLoan(
          {
            keys: [key.id],
            loanType: 'TENANT' as const,
            contact: 'test@example.com',
          },
          ctx.db
        )

        const deleted = await keyLoansAdapter.deleteKeyLoan(loan.id, ctx.db)

        expect(deleted).toBe(1)
      }))
  })
})
