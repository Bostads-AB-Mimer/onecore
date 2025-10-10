import { keyLoanService } from './api/keyLoanService'
import { receiptService } from './api/receiptService'

export type LoanKeysParams = {
  keyIds: string[]
  contact?: string
  contact2?: string
}

export type LoanKeysResult = {
  success: boolean
  title: string
  message?: string
  keyLoanId?: string
  receiptId?: string
}

/**
 * Handler for loaning out keys
 * @param keyIds - Array of key IDs to loan (can be single key)
 * @param contact - Primary contact name
 * @param contact2 - Secondary contact name (optional)
 * @returns Result with success status and keyLoanId
 */
export async function handleLoanKeys({
  keyIds,
  contact,
  contact2,
}: LoanKeysParams): Promise<LoanKeysResult> {
  if (keyIds.length === 0) {
    return {
      success: false,
      title: 'Fel',
      message: 'Inga nycklar valda',
    }
  }

  try {
    // Create the key loan
    const created = await keyLoanService.create({
      keys: JSON.stringify(keyIds),
      contact,
      contact2,
      pickedUpAt: new Date().toISOString(),
      createdBy: 'ui',
    })

    // Create receipt for this loan
    let receiptId: string | undefined
    try {
      const receipt = await receiptService.create({
        keyLoanId: created.id,
        receiptType: 'LOAN',
      })
      receiptId = receipt.id
    } catch (receiptErr) {
      // Receipt creation failed, but loan succeeded
      console.error('Failed to create receipt:', receiptErr)
    }

    return {
      success: true,
      title: 'Nyckel utlånad',
      keyLoanId: created.id,
      receiptId,
    }
  } catch (err: any) {
    const is409 = err?.status === 409 || err?.message?.includes('409')
    return {
      success: false,
      title: is409 ? 'Kan inte låna ut' : 'Fel',
      message: is409
        ? 'En eller flera nycklar är redan utlånade.'
        : err?.message || 'Kunde inte skapa nyckellån.',
    }
  }
}

export type ReturnKeysParams = {
  keyIds: string[]
}

export type ReturnKeysResult = {
  success: boolean
  title: string
  message?: string
}

/**
 * Handler for returning keys
 * Validates that all keys in each active loan are included in the return request
 * @param keyIds - Array of key IDs to return
 * @returns Result with success status
 */
export async function handleReturnKeys({
  keyIds,
}: ReturnKeysParams): Promise<ReturnKeysResult> {
  if (keyIds.length === 0) {
    return {
      success: false,
      title: 'Fel',
      message: 'Inga nycklar valda',
    }
  }

  try {
    const now = new Date().toISOString()
    const keyIdSet = new Set(keyIds)
    const processedLoanIds = new Set<string>()

    // Find all active loans for the selected keys
    for (const keyId of keyIds) {
      const loans = await keyLoanService.getByKeyId(keyId)
      const activeLoan = loans.find((loan) => !loan.returnedAt)

      if (!activeLoan || processedLoanIds.has(activeLoan.id)) {
        continue
      }

      // Parse all keys in this loan
      const loanKeyIds: string[] = JSON.parse(activeLoan.keys || '[]')

      // Check if ALL keys from this loan are in the return request
      const missingKeys = loanKeyIds.filter((id) => !keyIdSet.has(id))

      if (missingKeys.length > 0) {
        return {
          success: false,
          title: 'Kan inte återlämna',
          message: `Alla nycklar från samma utlåning måste återlämnas samtidigt. ${missingKeys.length} nyckel/nycklar saknas.`,
        }
      }

      // Mark this loan as processed and update it
      processedLoanIds.add(activeLoan.id)
      await keyLoanService.update(activeLoan.id, {
        returnedAt: now,
        availableToNextTenantFrom: now,
      } as any)
    }

    return {
      success: true,
      title: 'Nycklar återlämnade',
    }
  } catch (err: any) {
    return {
      success: false,
      title: 'Fel',
      message: err?.message || 'Kunde inte återlämna nycklar.',
    }
  }
}
