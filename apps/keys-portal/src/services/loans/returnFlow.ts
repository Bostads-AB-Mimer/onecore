/**
 * Return orchestration for a single loan — tenant or maintenance, full or partial.
 * The enriched loan carries everything the receipt needs (loanType, contact(s),
 * contactPerson), so there is no per-type branch beyond the Avtal auto-pick. The
 * dialog/hook fans these out across the affected loans.
 */
import { mergePdfBlobs } from '@/lib/pdf-merge'

import { keyLoanService } from '../api/keyLoanService'
import { receiptService } from '../api/receiptService'
import type {
  Card,
  CreateKeyLoanRequest,
  KeyDetails,
  KeyLoanWithDetails,
  UpdateKeyLoanRequest,
} from '../types'
import { createReceiptWithPdf } from './receiptIO'
import { buildReturnReceiptBlob } from './receiptPrint'
import { pickAutoContract, resolveObjectOptions } from './receiptResolution'

export type ReturnSelectionIds = {
  selectedKeyIds: Set<string>
  selectedCardIds: Set<string>
}

export type ReturnOpts = {
  availableToNextTenantFrom?: string | null
  comment?: string
}

/** Avtal block for a tenant return (auto-picked); maintenance returns carry none. */
async function autoContract(loan: KeyLoanWithDetails) {
  if (loan.loanType === 'MAINTENANCE') return {}
  return pickAutoContract(await resolveObjectOptions(loan))
}

/**
 * The shared core of every return: build the RETURN receipt, store it, then close the
 * loan. Receipt-before-close so a receipt failure (e.g. unresolved borrower) aborts the
 * return rather than leaving a closed loan without one. Returns the blob so the partial
 * flow can reuse it in the continuation loan's receipt. `partialReturn` only changes how
 * unchecked items render (missing/lost vs kvar på lån).
 */
async function closeLoanWithReturnReceipt(
  loan: KeyLoanWithDetails,
  { selectedKeyIds, selectedCardIds }: ReturnSelectionIds,
  opts: ReturnOpts,
  partialReturn: boolean
): Promise<Blob> {
  const { blob } = await buildReturnReceiptBlob({
    loan,
    loanKeys: (loan.keysArray ?? []) as KeyDetails[],
    selectedKeyIds,
    loanCards: (loan.keyCardsArray ?? []) as Card[],
    selectedCardIds,
    comment: opts.comment,
    partialReturn,
    ...(await autoContract(loan)),
  })

  await createReceiptWithPdf(loan.id, 'RETURN', blob, 'return')
  await keyLoanService.update(loan.id, {
    returnedAt: new Date().toISOString(),
    availableToNextTenantFrom: opts.availableToNextTenantFrom ?? null,
  } as UpdateKeyLoanRequest)

  return blob
}

/** Full return: close the loan with a receipt; unchecked non-disposed items are missing. */
export async function returnLoan(
  loan: KeyLoanWithDetails,
  selection: ReturnSelectionIds,
  opts: ReturnOpts = {}
): Promise<{ success: boolean; message?: string }> {
  try {
    await closeLoanWithReturnReceipt(loan, selection, opts, false)
    return { success: true }
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Kunde inte återlämna nycklar/droppar.',
    }
  }
}

/**
 * Partial return = the regular return (with unchecked rendered as kvar på lån) plus a
 * continuation loan for the unchecked non-disposed items, whose LOAN receipt is the
 * original loan receipt merged with this return PDF. Disposed keys never carry over.
 */
export async function partialReturnLoan(
  loan: KeyLoanWithDetails,
  selection: ReturnSelectionIds,
  opts: ReturnOpts = {}
): Promise<{
  success: boolean
  newLoanId?: string
  fellBackToReturnOnly?: boolean
  message?: string
}> {
  try {
    const allKeys = (loan.keysArray ?? []) as KeyDetails[]
    const allCards = (loan.keyCardsArray ?? []) as Card[]

    // Disposed keys stay with the closed old loan; never carry to the continuation.
    const unselectedKeyIds = allKeys
      .filter((k) => !k.disposed && !selection.selectedKeyIds.has(k.id))
      .map((k) => k.id)
    const unselectedCardIds = allCards
      .filter((c) => !selection.selectedCardIds.has(c.cardId))
      .map((c) => c.cardId)

    if (unselectedKeyIds.length === 0 && unselectedCardIds.length === 0) {
      return {
        success: false,
        message:
          'Inga nycklar eller droppar kvar att överföra till nytt lån. Använd vanlig återlämning istället.',
      }
    }

    // Regular return (partial-mode receipt) + close, reusing the shared core.
    const returnBlob = await closeLoanWithReturnReceipt(
      loan,
      selection,
      opts,
      true
    )

    // Tacked on: continuation loan with the unselected items, already active.
    // The continuation carries the parent loan's borrower verbatim.
    const newLoan = await keyLoanService.create({
      loanType: loan.loanType,
      contact: loan.contact,
      contact2: loan.contact2,
      contactPerson: loan.contactPerson,
      notes: loan.notes,
      pickedUpAt: new Date().toISOString(),
      ...(unselectedKeyIds.length > 0 ? { keys: unselectedKeyIds } : {}),
      ...(unselectedCardIds.length > 0 ? { keyCards: unselectedCardIds } : {}),
    } as CreateKeyLoanRequest)

    // Continuation LOAN receipt = original loan receipt + this return PDF (merged),
    // or the return PDF alone when there is no original to merge.
    const { blob, fellBack } = await mergeWithOriginalLoanReceipt(
      loan.id,
      returnBlob
    )
    await createReceiptWithPdf(newLoan.id, 'LOAN', blob, 'loan')

    return {
      success: true,
      newLoanId: newLoan.id,
      fellBackToReturnOnly: fellBack || undefined,
    }
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Kunde inte genomföra partiell retur.',
    }
  }
}

/** Original signed LOAN receipt merged before the return PDF; falls back to the return PDF. */
async function mergeWithOriginalLoanReceipt(
  oldLoanId: string,
  returnBlob: Blob
): Promise<{ blob: Blob; fellBack: boolean }> {
  try {
    const receipts = await receiptService.getByKeyLoan(oldLoanId)
    const original = receipts.find((r) => r.receiptType === 'LOAN' && r.fileId)
    if (!original) return { blob: returnBlob, fellBack: true }

    const { url } = await receiptService.getDownloadUrl(original.id)
    const resp = await fetch(url)
    if (!resp.ok) {
      throw new Error(`Kunde inte hämta ursprunglig kvittens: ${resp.status}`)
    }
    const merged = await mergePdfBlobs([await resp.blob(), returnBlob])
    return { blob: merged, fellBack: false }
  } catch (err) {
    console.error(
      'Failed to fetch/merge original loan receipt; using return PDF only:',
      err
    )
    return { blob: returnBlob, fellBack: true }
  }
}
