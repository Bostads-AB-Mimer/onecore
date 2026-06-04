/**
 * Creates a loan in its pending state (active only once a signed LOAN receipt is
 * uploaded) plus the empty LOAN receipt row. One path for tenant and maintenance —
 * maintenance passes its description through `notes` (the field the API actually has).
 */
import { keyLoanService } from '../api/keyLoanService'
import type { CreateKeyLoanRequest } from '../types'
import { createPendingReceipt } from './receiptIO'

export type CreatePendingLoanInput = {
  loanType: 'TENANT' | 'MAINTENANCE'
  keyIds?: string[]
  cardIds?: string[]
  contact: string // primary tenant or the maintenance company
  contact2?: string // optional second tenant
  contactPerson?: string | null
  notes?: string | null
}

export type CreatePendingLoanResult = {
  success: boolean
  title: string
  message?: string
  loanId?: string
  receiptId?: string
}

export async function createPendingLoan({
  loanType,
  keyIds = [],
  cardIds = [],
  contact,
  contact2,
  contactPerson,
  notes,
}: CreatePendingLoanInput): Promise<CreatePendingLoanResult> {
  if (keyIds.length === 0 && cardIds.length === 0) {
    return {
      success: false,
      title: 'Fel',
      message: 'Inga nycklar eller droppar valda',
    }
  }

  try {
    const payload: CreateKeyLoanRequest = {
      loanType,
      contact,
      ...(contact2 ? { contact2 } : {}),
      ...(contactPerson != null ? { contactPerson } : {}),
      ...(notes != null ? { notes } : {}),
      ...(keyIds.length > 0 ? { keys: keyIds } : {}),
      ...(cardIds.length > 0 ? { keyCards: cardIds } : {}),
      // createdBy is set by the backend from the authenticated user.
    }

    const created = await keyLoanService.create(payload)

    // Receipt row is non-fatal: the loan exists even if the row fails; it can be
    // (re)created on upload. We surface the id when we have it.
    let receiptId: string | undefined
    try {
      receiptId = (await createPendingReceipt(created.id, 'LOAN')).id
    } catch (receiptErr) {
      console.error('Failed to create loan receipt:', receiptErr)
    }

    return {
      success: true,
      title: 'Lån skapat – kvittens måste signeras',
      message: 'Lånet aktiveras när den signerade kvittensen laddas upp.',
      loanId: created.id,
      receiptId,
    }
  } catch (err: any) {
    const is409 = err?.status === 409 || err?.message?.includes('409')
    return {
      success: false,
      title: is409 ? 'Kan inte låna ut' : 'Fel',
      message: is409
        ? 'En eller flera nycklar/droppar är redan utlånade.'
        : err?.message || 'Kunde inte skapa lån.',
    }
  }
}
