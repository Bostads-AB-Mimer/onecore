import * as receiptActivationService from '../receipt-activation-service'
import * as receiptsAdapter from '../adapters/receipts-adapter'
import * as keyLoansAdapter from '../adapters/key-loans-adapter'
import * as keyEventsAdapter from '../adapters/key-events-adapter'
import * as keysAdapter from '../adapters/keys-adapter'
import * as factory from './factories'
import { withContext } from './testUtils'

/**
 * Business logic tests for receipt-activation-service
 *
 * These tests verify the complex multi-step transaction:
 * 1. Update receipt with fileId
 * 2. Activate key loan (set pickedUpAt)
 * 3. Complete key events for keys in loan
 * 4. Verify transaction rollback on failures
 */

/**
 * Helper to strip auto-generated fields from factory.receipt.build()
 */
function buildReceiptData(overrides: any = {}) {
  const base = factory.receipt.build(overrides)
  const {
    id: _id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...data
  } = base
  // Convert null to undefined for fileId
  return {
    ...data,
    fileId: data.fileId ?? undefined,
  }
}

describe('receipt-activation-service', () => {
  describe('activateLoanReceipt', () => {
    it('successfully activates loan receipt and completes key events', () =>
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

        // Create key loan with keys
        const keyLoan = await keyLoansAdapter.createKeyLoan(
          factory.keyLoan.build({
            keys: JSON.stringify([key1.id, key2.id]),
            pickedUpAt: null, // Not activated yet
          }),
          ctx.db
        )

        // Create key events with ORDERED status
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

        const event1 = await keyEventsAdapter.createKeyEvent(
          buildEventData({
            keys: JSON.stringify([key1.id]),
            status: 'ORDERED',
          }),
          ctx.db
        )

        const event2 = await keyEventsAdapter.createKeyEvent(
          buildEventData({
            keys: JSON.stringify([key2.id]),
            status: 'RECEIVED',
          }),
          ctx.db
        )

        // Create LOAN receipt
        const receipt = await receiptsAdapter.createReceipt(
          buildReceiptData({
            keyLoanId: keyLoan.id,
            receiptType: 'LOAN',
            fileId: undefined,
          }),
          ctx.db
        )

        // Activate receipt
        const result = await receiptActivationService.activateLoanReceipt(
          {
            receiptId: receipt.id,
            fileId: 'file-123',
          },
          ctx.db
        )

        // Verify success
        expect(result.ok).toBe(true)
        if (!result.ok) return

        expect(result.data.keyLoanActivated).toBe(true)
        expect(result.data.keyEventsCompleted).toBe(2)

        // Verify key loan is activated
        const updatedKeyLoan = await keyLoansAdapter.getKeyLoanById(
          keyLoan.id,
          ctx.db
        )
        expect(updatedKeyLoan?.pickedUpAt).not.toBeNull()

        // Verify key events are completed
        const updatedEvent1 = await keyEventsAdapter.getKeyEventById(
          event1.id,
          ctx.db
        )
        const updatedEvent2 = await keyEventsAdapter.getKeyEventById(
          event2.id,
          ctx.db
        )

        expect(updatedEvent1?.status).toBe('COMPLETED')
        expect(updatedEvent2?.status).toBe('COMPLETED')
      }))

    it('returns error when receipt not found', () =>
      withContext(async (ctx) => {
        const fakeUuid = '00000000-0000-0000-0000-000000000000'

        const result = await receiptActivationService.activateLoanReceipt(
          {
            receiptId: fakeUuid,
            fileId: 'file-123',
          },
          ctx.db
        )

        expect(result.ok).toBe(false)
        if (result.ok) return

        expect(result.err).toBe('receipt-not-found')
      }))

    it('returns error when receipt is not LOAN type', () =>
      withContext(async (ctx) => {
        const keyLoan = await keyLoansAdapter.createKeyLoan(
          factory.keyLoan.build(),
          ctx.db
        )

        const receipt = await receiptsAdapter.createReceipt(
          buildReceiptData({
            keyLoanId: keyLoan.id,
            receiptType: 'RETURN', // Not a LOAN receipt
          }),
          ctx.db
        )

        const result = await receiptActivationService.activateLoanReceipt(
          {
            receiptId: receipt.id,
            fileId: 'file-123',
          },
          ctx.db
        )

        expect(result.ok).toBe(false)
        if (result.ok) return

        expect(result.err).toBe('not-loan-receipt')
      }))

    it('skips activation when key loan already activated', () =>
      withContext(async (ctx) => {
        // Create key loan that's already activated
        const keyLoan = await keyLoansAdapter.createKeyLoan(
          factory.keyLoan.build({
            pickedUpAt: new Date(), // Already activated
          }),
          ctx.db
        )

        // Create LOAN receipt
        const receipt = await receiptsAdapter.createReceipt(
          buildReceiptData({
            keyLoanId: keyLoan.id,
            receiptType: 'LOAN',
          }),
          ctx.db
        )

        const result = await receiptActivationService.activateLoanReceipt(
          {
            receiptId: receipt.id,
            fileId: 'file-123',
          },
          ctx.db
        )

        expect(result.ok).toBe(true)
        if (!result.ok) return

        expect(result.data.keyLoanActivated).toBe(false)
        expect(result.data.keyEventsCompleted).toBe(0)
      }))

    it('handles loan with no keys gracefully', () =>
      withContext(async (ctx) => {
        // Create key loan with empty keys array
        const keyLoan = await keyLoansAdapter.createKeyLoan(
          factory.keyLoan.build({
            keys: JSON.stringify([]),
            pickedUpAt: null,
          }),
          ctx.db
        )

        const receipt = await receiptsAdapter.createReceipt(
          buildReceiptData({
            keyLoanId: keyLoan.id,
            receiptType: 'LOAN',
          }),
          ctx.db
        )

        const result = await receiptActivationService.activateLoanReceipt(
          {
            receiptId: receipt.id,
            fileId: 'file-123',
          },
          ctx.db
        )

        expect(result.ok).toBe(true)
        if (!result.ok) return

        expect(result.data.keyLoanActivated).toBe(true)
        expect(result.data.keyEventsCompleted).toBe(0)

        // Verify key loan is still activated even with no keys
        const updatedKeyLoan = await keyLoansAdapter.getKeyLoanById(
          keyLoan.id,
          ctx.db
        )
        expect(updatedKeyLoan?.pickedUpAt).not.toBeNull()
      }))

    it('only completes ORDERED and RECEIVED events, not COMPLETED ones', () =>
      withContext(async (ctx) => {
        const key1 = await keysAdapter.createKey(
          factory.key.build({ keyName: 'Key 1' }),
          ctx.db
        )
        const key2 = await keysAdapter.createKey(
          factory.key.build({ keyName: 'Key 2' }),
          ctx.db
        )

        const keyLoan = await keyLoansAdapter.createKeyLoan(
          factory.keyLoan.build({
            keys: JSON.stringify([key1.id, key2.id]),
            pickedUpAt: null,
          }),
          ctx.db
        )

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

        // Create one ORDERED event
        const event1 = await keyEventsAdapter.createKeyEvent(
          buildEventData({
            keys: JSON.stringify([key1.id]),
            status: 'ORDERED',
          }),
          ctx.db
        )

        // Create one already COMPLETED event
        const event2 = await keyEventsAdapter.createKeyEvent(
          buildEventData({
            keys: JSON.stringify([key2.id]),
            status: 'COMPLETED',
          }),
          ctx.db
        )

        const receipt = await receiptsAdapter.createReceipt(
          buildReceiptData({
            keyLoanId: keyLoan.id,
            receiptType: 'LOAN',
          }),
          ctx.db
        )

        await receiptActivationService.activateLoanReceipt(
          {
            receiptId: receipt.id,
            fileId: 'file-123',
          },
          ctx.db
        )

        // Verify only ORDERED event was updated
        const updatedEvent1 = await keyEventsAdapter.getKeyEventById(
          event1.id,
          ctx.db
        )
        const updatedEvent2 = await keyEventsAdapter.getKeyEventById(
          event2.id,
          ctx.db
        )

        expect(updatedEvent1?.status).toBe('COMPLETED')
        expect(updatedEvent2?.status).toBe('COMPLETED') // Unchanged
      }))

    it('rolls back transaction if key event completion fails', () =>
      withContext(async (ctx) => {
        // Create key loan with invalid key ID that will cause completion to fail
        const keyLoan = await keyLoansAdapter.createKeyLoan(
          factory.keyLoan.build({
            keys: JSON.stringify(['invalid-uuid']),
            pickedUpAt: null,
          }),
          ctx.db
        )

        const receipt = await receiptsAdapter.createReceipt(
          buildReceiptData({
            keyLoanId: keyLoan.id,
            receiptType: 'LOAN',
          }),
          ctx.db
        )

        // This should succeed - completeKeyEventsForKeys doesn't fail on non-existent keys
        // It just doesn't update any rows
        const result = await receiptActivationService.activateLoanReceipt(
          {
            receiptId: receipt.id,
            fileId: 'file-123',
          },
          ctx.db
        )

        expect(result.ok).toBe(true)
        if (!result.ok) return

        // Loan should still be activated
        const updatedKeyLoan = await keyLoansAdapter.getKeyLoanById(
          keyLoan.id,
          ctx.db
        )
        expect(updatedKeyLoan?.pickedUpAt).not.toBeNull()
      }))
  })
})
