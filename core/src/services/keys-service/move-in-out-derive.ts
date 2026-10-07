import { keys } from '@onecore/types'

type Key = keys.Key
type Card = keys.Card
type KeyLoanWithDetails = keys.KeyLoanWithDetails
type MoveInOutRow = keys.MoveInOutRow
type MoveInOutStatus = keys.MoveInOutStatus
type MoveInOutTenant = keys.MoveInOutTenant

/** Source-agnostic lease summary (built from lease search or leasing's Lease). */
export type LeaseSummary = MoveInOutTenant & { leaseNumber?: string }

export function isMaculated(lease: {
  leaseId: string
  leaseNumber?: string
}): boolean {
  const n = (lease.leaseNumber ?? '').trim()
  if (n && /[Mm]/.test(n)) return true
  const idTail = (lease.leaseId ?? '').split('/').pop() ?? ''
  return /[Mm]/.test(idTail.trim())
}

export function toDate(value: unknown): Date | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(d.getTime()) ? null : d
}

const time = (d: Date | null) => (d ? d.getTime() : null)

/**
 * Pick the outgoing and incoming lease for one rental object.
 * `endLeaseIds` / `startLeaseIds` are the leases that matched the date search.
 * The neighbour not matched by the search is taken from the full lease list.
 */
export function pickOutgoingIncoming(
  leases: LeaseSummary[],
  endLeaseIds: Set<string>,
  startLeaseIds: Set<string>
): { outgoing: LeaseSummary | null; incoming: LeaseSummary | null } {
  const sorted = leases
    .filter((l) => !isMaculated(l))
    .sort(
      (a, b) => (time(a.leaseStartDate) ?? 0) - (time(b.leaseStartDate) ?? 0)
    )

  const endMatches = sorted.filter((l) => endLeaseIds.has(l.leaseId))
  const startMatches = sorted.filter((l) => startLeaseIds.has(l.leaseId))

  let outgoing: LeaseSummary | null =
    endMatches.length > 0
      ? endMatches.reduce((best, l) =>
          (time(l.lastDebitDate) ?? 0) > (time(best.lastDebitDate) ?? 0)
            ? l
            : best
        )
      : null
  let incoming: LeaseSummary | null = startMatches[0] ?? null

  if (outgoing && incoming && outgoing.leaseId === incoming.leaseId) {
    // Same lease both starts and ends in range: treat it as the outgoing one
    incoming = null
  }

  const after = (ref: LeaseSummary) =>
    sorted.find(
      (l) =>
        l.leaseId !== ref.leaseId &&
        (time(l.leaseStartDate) ?? 0) > (time(ref.leaseStartDate) ?? 0)
    ) ?? null

  const before = (ref: LeaseSummary) =>
    [...sorted]
      .reverse()
      .find(
        (l) =>
          l.leaseId !== ref.leaseId &&
          (time(l.leaseStartDate) ?? 0) < (time(ref.leaseStartDate) ?? 0)
      ) ?? null

  if (outgoing && !incoming) incoming = after(outgoing)
  if (incoming && !outgoing) outgoing = before(incoming)

  return { outgoing, incoming }
}

export type DerivedStatus = Pick<
  MoveInOutRow,
  | 'keyCount'
  | 'cardCount'
  | 'outgoingAllReturned'
  | 'outgoingReturnedAt'
  | 'incomingLoanCreatedAt'
  | 'incomingLoanPickedUpAt'
  | 'status'
>

const loanContacts = (loan: KeyLoanWithDetails) =>
  [loan.contact, loan.contact2].filter((c): c is string => Boolean(c))

const belongsTo = (loan: KeyLoanWithDetails, tenant: LeaseSummary | null) =>
  tenant !== null &&
  loan.loanType === 'TENANT' &&
  loanContacts(loan).some((c) => tenant.contactCodes.includes(c))

const latestBy = <T>(items: T[], pick: (t: T) => Date | null | undefined) =>
  items.reduce<T | null>((best, item) => {
    if (!best) return item
    return (time(toDate(pick(item))) ?? 0) > (time(toDate(pick(best))) ?? 0)
      ? item
      : best
  }, null)

export function deriveStatus(input: {
  outgoing: LeaseSummary | null
  incoming: LeaseSummary | null
  keys: Key[]
  cards: Card[]
  loans: KeyLoanWithDetails[]
}): DerivedStatus {
  const { outgoing, incoming, keys, loans } = input
  // Archived DAX cards are history, not tags the tenant holds
  const cards = input.cards.filter((c) => c.state !== 'Archived')

  const itemIds = new Set<string>([
    ...keys.filter((k) => !k.disposed).map((k) => k.id),
    ...cards.map((c) => c.cardId),
  ])

  const incomingLoans = loans.filter((l) => belongsTo(l, incoming))
  const outgoingLoans = loans.filter(
    (l) => belongsTo(l, outgoing) && !incomingLoans.includes(l)
  )
  const otherOpenLoans = loans.filter(
    (l) =>
      !l.returnedAt && !incomingLoans.includes(l) && !outgoingLoans.includes(l)
  )

  const outgoingAllReturned =
    outgoingLoans.length > 0 ? outgoingLoans.every((l) => l.returnedAt) : null
  const outgoingReturnedAt =
    toDate(
      latestBy(
        outgoingLoans.filter((l) => l.returnedAt),
        (l) => toDate(l.returnedAt)
      )?.returnedAt
    ) ?? null

  const openIncoming = incomingLoans.filter((l) => !l.returnedAt)
  const incomingLoan =
    latestBy(openIncoming, (l) => toDate(l.createdAt)) ??
    latestBy(incomingLoans, (l) => toDate(l.createdAt))

  const base = {
    keyCount: keys.filter((k) => !k.disposed).length,
    cardCount: cards.length,
    outgoingAllReturned,
    outgoingReturnedAt,
    incomingLoanCreatedAt: toDate(incomingLoan?.createdAt),
    incomingLoanPickedUpAt: toDate(incomingLoan?.pickedUpAt),
  }

  let status: MoveInOutStatus
  if (itemIds.size === 0) {
    status = 'NO_KEYS'
  } else if (outgoingAllReturned === false) {
    status = 'NOT_RETURNED'
  } else if (otherOpenLoans.length > 0) {
    status = 'LOANED_TO_OTHER'
  } else if (openIncoming.length > 0) {
    const covered = new Set<string>()
    for (const loan of openIncoming) {
      loan.keysArray.forEach((k) => itemIds.has(k.id) && covered.add(k.id))
      loan.keyCardsArray.forEach(
        (c) => itemIds.has(c.cardId) && covered.add(c.cardId)
      )
    }
    if (covered.size < itemIds.size) {
      status = 'PARTIAL'
    } else {
      status = openIncoming.every((l) => l.pickedUpAt)
        ? 'HANDED_OUT'
        : 'CREATED'
    }
  } else if (!incoming && outgoingLoans.length > 0) {
    status = 'RETURNED_VACANT'
  } else {
    status = 'NO_LOANS'
  }

  return { ...base, status }
}
