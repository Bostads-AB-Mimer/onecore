/**
 * Business logic service for activating receipts and key loans
 *
 * This service handles the complex multi-step transaction when a LOAN receipt is signed:
 * 1. Update receipt with fileId (marks as signed)
 * 2. Check if key loan is already activated
 * 3. Activate key loan (set pickedUpAt timestamp)
 * 4. Complete any incomplete key events for keys in the loan
 *
 * All operations are wrapped in a transaction to ensure data consistency.
 */

import { Knex } from 'knex'
import * as receiptsAdapter from './adapters/receipts-adapter'
import { logger } from '@onecore/utilities'

export interface ActivateReceiptParams {
  receiptId: string
  fileId: string
}

export type Result<T, E = string> =
  | { ok: true; data: T }
  | { ok: false; err: E }

/**
 * Activate a LOAN receipt by uploading signed document
 *
 * This function coordinates multiple operations in a transaction:
 * - Updates receipt with fileId (indicating it's been signed)
 * - Activates the key loan (sets pickedUpAt)
 * - Completes key events for keys in the loan (changes status to COMPLETED)
 *
 * If any step fails, the entire transaction is rolled back.
 *
 * @returns Result indicating success or specific failure point
 */
export async function activateLoanReceipt(
  params: ActivateReceiptParams,
  dbConnection: Knex | Knex.Transaction
): Promise<
  Result<{ keyLoanActivated: boolean; keyEventsCompleted: number }, string>
> {
  try {
    // Find receipt
    const receipt = await receiptsAdapter.getReceiptById(
      params.receiptId,
      dbConnection
    )

    if (!receipt) {
      return { ok: false, err: 'receipt-not-found' }
    }

    // Only activate LOAN receipts
    if (receipt.receiptType !== 'LOAN') {
      return { ok: false, err: 'not-loan-receipt' }
    }

    // Perform all operations in transaction
    const result = await dbConnection.transaction(async (trx) => {
      // Step 1: Update receipt with fileId (marks as signed)
      await receiptsAdapter.updateReceiptFileId(
        params.receiptId,
        params.fileId,
        trx
      )

      // Step 2: Check if key loan is already activated
      const keyLoanAlreadyActivated = await receiptsAdapter.isKeyLoanActivated(
        receipt.keyLoanId,
        trx
      )

      if (keyLoanAlreadyActivated) {
        // Loan already activated, no further action needed
        logger.info(
          { keyLoanId: receipt.keyLoanId, receiptId: params.receiptId },
          'Key loan already activated, skipping activation'
        )
        return {
          ok: true,
          data: { keyLoanActivated: false, keyEventsCompleted: 0 },
        } as const
      }

      // Step 3: Activate key loan by setting pickedUpAt
      await receiptsAdapter.activateKeyLoan(receipt.keyLoanId, trx)

      logger.info(
        { keyLoanId: receipt.keyLoanId, receiptId: params.receiptId },
        'Key loan activated after signed receipt uploaded'
      )

      // Step 4: Get key loan to retrieve keys
      const keyLoan = await receiptsAdapter.getKeyLoanById(
        receipt.keyLoanId,
        trx
      )

      if (!keyLoan?.keys) {
        // No keys in loan, nothing to complete
        return {
          ok: true,
          data: { keyLoanActivated: true, keyEventsCompleted: 0 },
        } as const
      }

      // Step 5: Parse keys JSON
      let keyIds: string[] = []
      try {
        keyIds = JSON.parse(keyLoan.keys)
      } catch (err) {
        logger.warn(
          {
            keyLoanId: receipt.keyLoanId,
            keysValue: keyLoan.keys,
            parseError: err,
          },
          'Failed to parse keys JSON, skipping key event completion'
        )
        return {
          ok: true,
          data: { keyLoanActivated: true, keyEventsCompleted: 0 },
        } as const
      }

      if (keyIds.length === 0) {
        return {
          ok: true,
          data: { keyLoanActivated: true, keyEventsCompleted: 0 },
        } as const
      }

      // Step 6: Complete key events for keys in this loan
      await receiptsAdapter.completeKeyEventsForKeys(keyIds, trx)

      logger.info(
        { keyLoanId: receipt.keyLoanId, keyCount: keyIds.length },
        'Completed key events for picked up keys'
      )

      return {
        ok: true,
        data: { keyLoanActivated: true, keyEventsCompleted: keyIds.length },
      } as const
    })

    return result
  } catch (err: any) {
    logger.error(
      { err, receiptId: params.receiptId },
      'Error activating loan receipt'
    )

    // Map known error messages to specific error codes
    const errorMessage = err.message || 'unknown'
    const knownErrors = [
      'receipt-not-found',
      'not-loan-receipt',
      'update-receipt-failed',
    ]

    if (knownErrors.includes(errorMessage)) {
      return { ok: false, err: errorMessage }
    }

    return { ok: false, err: 'transaction-failed' }
  }
}
