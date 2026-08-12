/**
 * Receipt data assembly — turns a loan + a return selection into the one PDF-layer
 * input (`ReceiptData`). Resolves facts via `receiptResolution` and shapes them;
 * `receiptPrint` renders the result. Tenant and maintenance share everything except
 * the borrower's `loanType` and a couple of header fields (Avtal vs scope).
 */
import { keyLoanService } from '../api/keyLoanService'
import { receiptService } from '../api/receiptService'
import type {
  Card,
  KeyDetails,
  KeyLoanWithDetails,
  ReceiptData,
} from '../types'
import {
  categorizeCards,
  categorizeKeys,
  resolveBorrowers,
  resolveObjectOptions,
  resolveScopeByKeyId,
  type LoanObjectOption,
} from './receiptResolution'

/** Merges a loan's stored notes with a print-time comment for the KOMMENTAR box. */
export function mergeComment(
  notes?: string | null,
  comment?: string | null
): string | undefined {
  return [notes, comment].filter(Boolean).join('\n\n') || undefined
}

// ----- Shared return core -----

// TODO: unify keys + cards into one `loanItems` model so the parallel key/card
// handling (categorize, buckets, missing*/remaining*/disposed*, ReceiptData fields)
// collapses to a single path instead of being duplicated for each item kind.
/** The item buckets a return receipt renders. */
type ReturnBuckets = Pick<
  ReceiptData,
  | 'keys'
  | 'missingKeys'
  | 'disposedKeys'
  | 'cards'
  | 'missingCards'
  | 'remainingLoanKeys'
  | 'remainingLoanCards'
>

/** The item selection a return is built from. */
export type ReturnSelection = {
  loanKeys: KeyDetails[]
  selectedKeyIds: Set<string>
  loanCards?: Card[]
  selectedCardIds?: Set<string>
  /** When true, unchecked items continue on a new loan ("kvar på lån"), not missing. */
  partialReturn?: boolean
}

/**
 * Splits a return selection into returned/missing/disposed/remaining. On a partial
 * return the unchecked items become `remaining*` rather than `missing*`.
 */
function buildReturnBuckets({
  loanKeys,
  selectedKeyIds,
  loanCards = [],
  selectedCardIds = new Set(),
  partialReturn = false,
}: ReturnSelection): ReturnBuckets {
  const { returned, missing, disposed } = categorizeKeys(
    loanKeys,
    selectedKeyIds
  )
  const { returned: cards, missing: missingCards } = categorizeCards(
    loanCards,
    selectedCardIds
  )
  const some = <T>(xs: T[]) => (xs.length > 0 ? xs : undefined)

  return {
    keys: returned,
    disposedKeys: some(disposed),
    cards: some(cards),
    missingKeys: partialReturn ? undefined : some(missing),
    missingCards: partialReturn ? undefined : some(missingCards),
    remainingLoanKeys: partialReturn ? some(missing) : undefined,
    remainingLoanCards: partialReturn ? some(missingCards) : undefined,
  }
}

// ----- Return receipt (tenant + maintenance) -----

/** A return receipt's input: the loan it belongs to, the selection, and the Avtal block. */
export type ReturnReceiptInput = ReturnSelection & {
  loan: Pick<
    KeyLoanWithDetails,
    'contact' | 'contact2' | 'loanType' | 'contactPerson'
  >
  comment?: string
  // Tenant Avtal block, resolved/picked by the caller (ignored for maintenance):
  rentalPropertyId?: string
  address?: string | null
  leaseDisplayId?: string
}

/**
 * Assembles the one ReceiptData for a return. Borrower is resolved from the loan
 * (tenant or company); maintenance adds the per-key scope, tenant adds the Avtal block.
 */
export async function assembleReturnReceiptData(
  input: ReturnReceiptInput
): Promise<ReceiptData> {
  const { loan, comment, rentalPropertyId, address, leaseDisplayId } = input
  const maintenance = loan.loanType === 'MAINTENANCE'

  return {
    ...buildReturnBuckets(input),
    receiptType: 'RETURN',
    loanType: loan.loanType,
    operationDate: new Date(),
    contacts: await resolveBorrowers(loan),
    contactPerson: loan.contactPerson ?? null,
    comment,
    rentalPropertyId: maintenance ? undefined : rentalPropertyId,
    address: maintenance ? null : (address ?? null),
    leaseDisplayId: maintenance ? undefined : leaseDisplayId,
    scopeByKeyId: maintenance
      ? await resolveScopeByKeyId(input.loanKeys)
      : undefined,
  }
}

// ----- Loan receipt preview / print (tenant + maintenance) -----

/**
 * Prepares a loan/return receipt from a loanId or receiptId in ONE loan fetch: the
 * ReceiptData plus, for tenant loans, the per-object options the dialog uses to pick
 * object + Avtals-ID. Maintenance loans carry their per-key scope and notes instead.
 */
export async function prepareReceipt({
  receiptId,
  loanId,
}: {
  receiptId?: string | null
  loanId?: string | null
}): Promise<{ receiptData: ReceiptData; objectOptions: LoanObjectOption[] }> {
  let receiptType: 'LOAN' | 'RETURN' = 'LOAN'
  let resolvedLoanId = loanId ?? null
  if (receiptId) {
    const receipt = await receiptService.getById(receiptId)
    receiptType = receipt.receiptType
    resolvedLoanId = receipt.keyLoanId
  }
  if (!resolvedLoanId) {
    throw new Error('Kan inte skapa kvittens: lånet saknas.')
  }

  const loan = (await keyLoanService.get(resolvedLoanId, {
    includeKeySystem: true,
    includeCards: true,
  })) as KeyLoanWithDetails

  const maintenance = loan.loanType === 'MAINTENANCE'
  const keys = loan.keysArray as KeyDetails[]
  const cards = loan.keyCardsArray || []
  const date = receiptType === 'LOAN' ? loan.createdAt : loan.returnedAt

  const receiptData: ReceiptData = {
    receiptType,
    loanType: loan.loanType,
    contacts: await resolveBorrowers(loan),
    contactPerson: loan.contactPerson ?? null,
    keys,
    cards: cards.length > 0 ? cards : undefined,
    operationDate: date ? new Date(date) : new Date(),
    loanId: loan.id,
    comment: maintenance ? (loan.notes ?? undefined) : undefined,
    scopeByKeyId: maintenance ? await resolveScopeByKeyId(keys) : undefined,
  }

  const objectOptions = maintenance ? [] : await resolveObjectOptions(loan)
  return { receiptData, objectOptions }
}
