import { keyLoanService } from './api/keyLoanService'
import { receiptService } from './api/receiptService'
import { handleGenerateSwitchReceipts } from './receiptHandlers'
import type { Key, Lease, ReceiptData } from './types'

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
        type: 'PHYSICAL', // <-- IMPORTANT: ensure backend accepts and returns an ID
      })
      receiptId = receipt.id
    } catch (receiptErr) {
      // Receipt creation failed, but loan succeeded
      console.error('Failed to create receipt:', receiptErr)
    }

    return {
      success: true,
      title: 'Nyckel utlånad - Kvitto måste signeras',
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
  keyLoanId?: string
  receiptId?: string
}

/**
 * Handler for returning keys
 * Validates that all keys in each active loan are included in the return request
 * Creates a return receipt for the returned keys
 * @param keyIds - Array of key IDs to return
 * @returns Result with success status, keyLoanId, and receiptId
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
    let lastProcessedLoanId: string | undefined
    let receiptId: string | undefined

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
      lastProcessedLoanId = activeLoan.id
      await keyLoanService.update(activeLoan.id, {
        returnedAt: now,
        availableToNextTenantFrom: now,
      } as any)

      // Create return receipt for this loan
      try {
        const receipt = await receiptService.create({
          keyLoanId: activeLoan.id,
          receiptType: 'RETURN',
          type: 'PHYSICAL',
        })
        receiptId = receipt.id
      } catch (receiptErr) {
        console.error('Failed to create return receipt:', receiptErr)
      }
    }

    return {
      success: true,
      title: 'Nycklar återlämnade',
      keyLoanId: lastProcessedLoanId,
      receiptId,
    }
  } catch (err: any) {
    return {
      success: false,
      title: 'Fel',
      message: err?.message || 'Kunde inte återlämna nycklar.',
    }
  }
}

export type SwitchKeysParams = {
  keyIdsToSwitch: string[] // Keys being replaced/switched
  contact?: string
  contact2?: string
}

export type SwitchKeysResult = {
  success: boolean
  title: string
  message?: string
  returnReceiptId?: string
  newKeyLoanId?: string
  newLoanReceiptId?: string
}

/**
 * Handler for switching/replacing keys
 * Creates a return receipt for all keys (marking selected keys as missing),
 * marks the loan as returned, and creates a new loan with all keys (including replacement)
 * @param keyIdsToSwitch - Array of key IDs being replaced/switched
 * @param contact - Primary contact name for new loan
 * @param contact2 - Secondary contact name for new loan (optional)
 * @returns Result with success status and receipt/loan IDs
 */
export async function handleSwitchKeys({
  keyIdsToSwitch,
  contact,
  contact2,
}: SwitchKeysParams): Promise<SwitchKeysResult> {
  if (keyIdsToSwitch.length === 0) {
    return {
      success: false,
      title: 'Fel',
      message: 'Inga nycklar valda',
    }
  }

  try {
    const now = new Date().toISOString()
    const keyIdSet = new Set(keyIdsToSwitch)
    const processedLoanIds = new Set<string>()
    let returnReceiptId: string | undefined
    let newKeyLoanId: string | undefined
    let newLoanReceiptId: string | undefined

    // Find all active loans for the selected keys
    for (const keyId of keyIdsToSwitch) {
      const loans = await keyLoanService.getByKeyId(keyId)
      const activeLoan = loans.find((loan) => !loan.returnedAt)

      if (!activeLoan || processedLoanIds.has(activeLoan.id)) {
        continue
      }

      // Parse all keys in this loan
      const loanKeyIds: string[] = JSON.parse(activeLoan.keys || '[]')

      // Mark this loan as processed
      processedLoanIds.add(activeLoan.id)

      // Step 1: Mark the original loan as returned
      await keyLoanService.update(activeLoan.id, {
        returnedAt: now,
        availableToNextTenantFrom: now,
      } as any)

      // Step 2: Create return receipt (will be marked with missing keys)
      // Note: The actual PDF generation with missing keys will be handled in the component
      try {
        const returnReceipt = await receiptService.create({
          keyLoanId: activeLoan.id,
          receiptType: 'RETURN',
          type: 'PHYSICAL',
        })
        returnReceiptId = returnReceipt.id
      } catch (receiptErr) {
        console.error('Failed to create return receipt:', receiptErr)
      }

      // Step 3: Create new loan with ALL keys (including replacement)
      const newLoan = await keyLoanService.create({
        keys: JSON.stringify(loanKeyIds), // ALL keys from original loan
        contact,
        contact2,
        pickedUpAt: null, // Pending signature
        createdBy: 'ui',
      })
      newKeyLoanId = newLoan.id

      // Step 4: Create new loan receipt (unsigned, waiting for signature/upload)
      try {
        const loanReceipt = await receiptService.create({
          keyLoanId: newLoan.id,
          receiptType: 'LOAN',
          type: 'PHYSICAL',
        })
        newLoanReceiptId = loanReceipt.id
      } catch (receiptErr) {
        console.error('Failed to create loan receipt:', receiptErr)
      }
    }

    return {
      success: true,
      title: 'Nyckel bytt',
      message: 'Returkvitto och nytt utlåningskvitto har skapats.',
      returnReceiptId,
      newKeyLoanId,
      newLoanReceiptId,
    }
  } catch (err: any) {
    return {
      success: false,
      title: 'Fel',
      message: err?.message || 'Kunde inte byta nyckel.',
    }
  }
}

export type SwitchKeysWithReceiptsParams = {
  keyIdsToSwitch: string[]
  contact?: string
  contact2?: string
  lease: Lease
  allKeys: Key[]
}

export type SwitchKeysWithReceiptsResult = {
  success: boolean
  title: string
  message?: string
  receiptData?: ReceiptData
  receiptId?: string
}

/**
 * Comprehensive handler for switching keys with receipt generation
 * Handles the entire flow: fetch active loan, categorize keys, switch operation, generate PDFs
 * @param params - Parameters including keyIdsToSwitch, contact info, lease, and all available keys
 * @returns Result with success status, receipts, and toast data
 */
export async function handleSwitchKeysWithReceipts({
  keyIdsToSwitch,
  contact,
  contact2,
  lease,
  allKeys,
}: SwitchKeysWithReceiptsParams): Promise<SwitchKeysWithReceiptsResult> {
  if (keyIdsToSwitch.length === 0) {
    return {
      success: false,
      title: 'Fel',
      message: 'Inga nycklar valda',
    }
  }

  try {
    // Step 1: Fetch active loan for the first key
    const loans = await keyLoanService.getByKeyId(keyIdsToSwitch[0])
    const activeLoan = loans.find((loan) => !loan.returnedAt)

    if (!activeLoan) {
      return {
        success: false,
        title: 'Fel',
        message: 'Kunde inte hitta aktivt lån för vald nyckel',
      }
    }

    // Step 2: Parse and categorize keys from the active loan
    const loanKeyIds: string[] = JSON.parse(activeLoan.keys || '[]')
    const allLoanKeys = allKeys.filter((k) => loanKeyIds.includes(k.id))
    const switchedKeys = allLoanKeys.filter((k) =>
      keyIdsToSwitch.includes(k.id)
    )
    const returnedKeys = allLoanKeys.filter(
      (k) => !keyIdsToSwitch.includes(k.id)
    )

    // Step 3: Perform the switch operation
    const switchResult = await handleSwitchKeys({
      keyIdsToSwitch,
      contact,
      contact2,
    })

    if (!switchResult.success) {
      return {
        success: false,
        title: switchResult.title,
        message: switchResult.message,
      }
    }

    // Step 4: Generate PDFs if we have receipt IDs
    let receiptData: ReceiptData | undefined
    let receiptId: string | undefined

    if (switchResult.returnReceiptId && switchResult.newLoanReceiptId) {
      const pdfResult = await handleGenerateSwitchReceipts({
        lease,
        allLoanKeys,
        switchedKeys,
        returnedKeys,
        returnReceiptId: switchResult.returnReceiptId,
        newLoanReceiptId: switchResult.newLoanReceiptId,
      })

      if (pdfResult.success) {
        // Prepare receipt data for dialog display
        receiptData = {
          lease,
          tenants: lease.tenants ?? [],
          keys: allLoanKeys,
          receiptType: 'LOAN',
          operationDate: new Date(),
        }
        receiptId = switchResult.newLoanReceiptId
      } else {
        console.error('Failed to generate PDFs:', pdfResult.error)
      }
    }

    return {
      success: true,
      title: switchResult.title,
      message: switchResult.message,
      receiptData,
      receiptId,
    }
  } catch (err: any) {
    return {
      success: false,
      title: 'Fel',
      message: err?.message || 'Kunde inte byta nyckel',
    }
  }
}
