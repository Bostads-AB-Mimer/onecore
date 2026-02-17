import { keys } from '@onecore/types'
import * as receiptsAdapter from '../../adapters/receipts-adapter'
import * as keyLoansAdapter from '../../adapters/key-loans-adapter'
import * as keyEventsAdapter from '../../adapters/key-events-adapter'
import * as keysAdapter from '../../adapters/keys-adapter'
import * as factory from '../factories'
import { withContext } from '../testUtils'

type CreateKeyEventRequest = keys.CreateKeyEventRequest

/**
 * Integration tests for receipts-adapter
 *
 * These tests verify:
 * - CRUD operations on receipts table
 * - Key loan validation (keyLoanExists)
 * - Key loan activation logic (pickedUpAt)
 * - Receipt file ID updates
 * - Key event completion for receipts
 *
 * Pattern adopted from services/leasing adapter tests
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

describe('receipts-adapter', () => {
  describe('createReceipt', () => {
    it('creates a receipt in the database', () =>
      withContext(async (ctx) => {
        // Create a key loan first
        const keyLoan = await keyLoansAdapter.createKeyLoan(
          factory.keyLoan.build(),
          ctx.db
        )

        const receiptData = {
          keyLoanId: keyLoan.id,
          loanType: 'REGULAR' as const,
          receiptType: 'LOAN' as const,
          type: 'DIGITAL' as const,
          fileId: undefined,
        }

        const receipt = await receiptsAdapter.createReceipt(receiptData, ctx.db)

        expect(receipt.id).toBeDefined()
        expect(receipt.keyLoanId).toBe(keyLoan.id)
        expect(receipt.receiptType).toBe('LOAN')
        expect(receipt.type).toBe('DIGITAL')
        expect(receipt.fileId).toBeNull()
        expect(receipt.createdAt).toBeDefined()
        expect(receipt.updatedAt).toBeDefined()
      }))
  })

  describe('getReceiptById', () => {
    it('returns receipt when it exists', () =>
      withContext(async (ctx) => {
        const keyLoan = await keyLoansAdapter.createKeyLoan(
          factory.keyLoan.build(),
          ctx.db
        )
        const created = await receiptsAdapter.createReceipt(
          buildReceiptData({ keyLoanId: keyLoan.id }),
          ctx.db
        )

        const receipt = await receiptsAdapter.getReceiptById(created.id, ctx.db)

        expect(receipt).toBeDefined()
        expect(receipt?.id).toBe(created.id)
        expect(receipt?.keyLoanId).toBe(keyLoan.id)
      }))
  })

  describe('getReceiptsByKeyLoanId', () => {
    it('returns all receipts for a key loan ordered by createdAt desc', () =>
      withContext(async (ctx) => {
        const keyLoan = await keyLoansAdapter.createKeyLoan(
          factory.keyLoan.build(),
          ctx.db
        )

        const receipt1 = await receiptsAdapter.createReceipt(
          buildReceiptData({
            keyLoanId: keyLoan.id,
            receiptType: 'LOAN',
          }),
          ctx.db
        )

        // Wait a bit to ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 10))

        const receipt2 = await receiptsAdapter.createReceipt(
          buildReceiptData({
            keyLoanId: keyLoan.id,
            receiptType: 'RETURN',
          }),
          ctx.db
        )

        const receipts = await receiptsAdapter.getReceiptsByKeyLoanId(
          keyLoan.id,
          ctx.db
        )

        expect(receipts.length).toBe(2)
        // Should be ordered by createdAt desc (newest first)
        expect(receipts[0].id).toBe(receipt2.id)
        expect(receipts[1].id).toBe(receipt1.id)
      }))
  })

  describe('updateReceipt', () => {
    it('updates receipt fields successfully', () =>
      withContext(async (ctx) => {
        const keyLoan = await keyLoansAdapter.createKeyLoan(
          factory.keyLoan.build(),
          ctx.db
        )
        const receipt = await receiptsAdapter.createReceipt(
          buildReceiptData({
            keyLoanId: keyLoan.id,
            type: 'DIGITAL',
          }),
          ctx.db
        )

        const updated = await receiptsAdapter.updateReceipt(
          receipt.id,
          { fileId: 'test-file-id' },
          ctx.db
        )

        expect(updated).toBeDefined()
        expect(updated?.fileId).toBe('test-file-id')
        expect(updated?.type).toBe('DIGITAL') // Unchanged
        expect(updated?.keyLoanId).toBe(keyLoan.id) // Unchanged
      }))
  })

  describe('deleteReceipt', () => {
    it('deletes receipt from database', () =>
      withContext(async (ctx) => {
        const keyLoan = await keyLoansAdapter.createKeyLoan(
          factory.keyLoan.build(),
          ctx.db
        )
        const receipt = await receiptsAdapter.createReceipt(
          buildReceiptData({ keyLoanId: keyLoan.id }),
          ctx.db
        )

        const deleted = await receiptsAdapter.deleteReceipt(receipt.id, ctx.db)

        expect(deleted).toBe(1)
      }))
  })

  describe('keyLoanExists', () => {
    it('returns true when key loan exists', () =>
      withContext(async (ctx) => {
        const keyLoan = await keyLoansAdapter.createKeyLoan(
          factory.keyLoan.build(),
          ctx.db
        )

        const exists = await receiptsAdapter.keyLoanExists(keyLoan.id, ctx.db)
        expect(exists).toBe(true)
      }))
  })

  describe('updateReceiptFileId', () => {
    it('updates receipt fileId', () =>
      withContext(async (ctx) => {
        const keyLoan = await keyLoansAdapter.createKeyLoan(
          factory.keyLoan.build(),
          ctx.db
        )
        const receipt = await receiptsAdapter.createReceipt(
          buildReceiptData({ keyLoanId: keyLoan.id, fileId: undefined }),
          ctx.db
        )

        await receiptsAdapter.updateReceiptFileId(
          receipt.id,
          'new-file-uuid',
          ctx.db
        )

        const updated = await receiptsAdapter.getReceiptById(receipt.id, ctx.db)
        expect(updated?.fileId).toBe('new-file-uuid')
      }))
  })

  describe('getKeyLoanById', () => {
    it('returns key loan by id', () =>
      withContext(async (ctx) => {
        const key = await keysAdapter.createKey(factory.key.build(), ctx.db)
        const keyLoan = await keyLoansAdapter.createKeyLoan(
          {
            keys: [key.id],
            loanType: 'TENANT' as const,
            contact: 'test@example.com',
            pickedUpAt: null,
          },
          ctx.db
        )

        const loan = await receiptsAdapter.getKeyLoanById(keyLoan.id, ctx.db)

        expect(loan).toBeDefined()
        expect(loan?.id).toBe(keyLoan.id)
        expect(loan?.pickedUpAt).toBeNull()
      }))
  })

  describe('isKeyLoanActivated', () => {
    it('returns true when loan has pickedUpAt set', () =>
      withContext(async (ctx) => {
        const keyLoan = await keyLoansAdapter.createKeyLoan(
          factory.keyLoan.build({ pickedUpAt: new Date() }),
          ctx.db
        )

        const isActivated = await receiptsAdapter.isKeyLoanActivated(
          keyLoan.id,
          ctx.db
        )
        expect(isActivated).toBe(true)
      }))
  })

  describe('activateKeyLoan', () => {
    it('sets pickedUpAt timestamp on key loan', () =>
      withContext(async (ctx) => {
        const keyLoan = await keyLoansAdapter.createKeyLoan(
          factory.keyLoan.build({ pickedUpAt: null }),
          ctx.db
        )

        expect(keyLoan.pickedUpAt).toBeNull()

        await receiptsAdapter.activateKeyLoan(keyLoan.id, ctx.db)

        const updated = await keyLoansAdapter.getKeyLoanById(keyLoan.id, ctx.db)
        expect(updated?.pickedUpAt).not.toBeNull()
        expect(updated?.pickedUpAt).toBeInstanceOf(Date)
      }))
  })

  describe('completeKeyEventsForKeys', () => {
    it('updates key event status to COMPLETED for given keys', () =>
      withContext(async (ctx) => {
        // Create real keys
        const key1 = await keysAdapter.createKey(
          factory.key.build({ keyName: 'Event Key 1' }),
          ctx.db
        )
        const key2 = await keysAdapter.createKey(
          factory.key.build({ keyName: 'Event Key 2' }),
          ctx.db
        )

        // Create key events with ORDERED status
        function buildEventData(overrides: any = {}): CreateKeyEventRequest {
          const base = factory.keyEvent.build(overrides)
          const {
            id: _id,
            createdAt: _createdAt,
            updatedAt: _updatedAt,
            ...data
          } = base
          return { ...data, ...overrides }
        }

        const event1 = await keyEventsAdapter.createKeyEvent(
          buildEventData({
            keys: [key1.id],
            status: 'ORDERED',
          }),
          ctx.db
        )

        const event2 = await keyEventsAdapter.createKeyEvent(
          buildEventData({
            keys: [key2.id],
            status: 'RECEIVED',
          }),
          ctx.db
        )

        // Complete events for these keys
        await receiptsAdapter.completeKeyEventsForKeys(
          [key1.id, key2.id],
          ctx.db
        )

        // Verify events are now COMPLETED
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
  })
})
