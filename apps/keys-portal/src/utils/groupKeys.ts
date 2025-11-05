import type { KeyWithLoanAndEvent } from '@/services/types'

/**
 * Grouped key structure for display
 */
export interface GroupedKeys {
  nonDisposed: DisposedGroup
  disposed: DisposedGroup
}

export interface DisposedGroup {
  loaned: LoanedGroup[]
  unloaned: KeyWithLoanAndEvent[]
}

export interface LoanedGroup {
  contact: string
  loans: LoanGroup[]
}

export interface LoanGroup {
  loanId: string
  loanContact: string | null
  loanContactPerson: string | null
  loanPickedUpAt: string | null
  loanCreatedAt: string | null
  keys: KeyWithLoanAndEvent[]
}

/**
 * Group and sort keys according to the hierarchy:
 * 1. Disposed status (non-disposed first, then disposed)
 * 2. Loan status (loaned first, then unloaned)
 * 3. Contact (within loaned keys)
 * 4. Specific loan (within each contact)
 * 5. Key type (within each loan or unloaned section)
 * 6. Key name (within each type)
 */
export function groupAndSortKeys(keys: KeyWithLoanAndEvent[]): GroupedKeys {
  // 1. Primary split: disposed vs non-disposed
  const nonDisposedKeys = keys.filter((k) => !k.disposed)
  const disposedKeys = keys.filter((k) => k.disposed)

  return {
    nonDisposed: processDisposedGroup(nonDisposedKeys),
    disposed: processDisposedGroup(disposedKeys),
  }
}

/**
 * Process a group of keys (either disposed or non-disposed)
 * Split into loaned vs unloaned, then group loaned by contact and loan
 */
function processDisposedGroup(keys: KeyWithLoanAndEvent[]): DisposedGroup {
  // 2. Secondary split: loaned vs unloaned (check for maintenance loans only)
  const loanedKeys = keys.filter(
    (k) => k.loan !== null && k.loan.loanType === 'MAINTENANCE'
  )
  const unloanedKeys = keys.filter(
    (k) => k.loan === null || k.loan.loanType !== 'MAINTENANCE'
  )

  // 3. Group loaned keys by contact
  const loanedByContact = groupByContact(loanedKeys)

  // Sort unloaned keys by type then name
  const sortedUnloaned = sortKeysByTypeAndName(unloanedKeys)

  return {
    loaned: loanedByContact,
    unloaned: sortedUnloaned,
  }
}

/**
 * Group loaned keys by contact, then by specific loan
 */
function groupByContact(keys: KeyWithLoanAndEvent[]): LoanedGroup[] {
  // Group by contact
  const byContact = keys.reduce(
    (acc, key) => {
      const contact = key.loan?.contact || 'Okänt företag'
      if (!acc[contact]) {
        acc[contact] = []
      }
      acc[contact].push(key)
      return acc
    },
    {} as Record<string, KeyWithLoanAndEvent[]>
  )

  // For each contact, group by specific loan
  const result: LoanedGroup[] = Object.entries(byContact)
    .map(([contact, contactKeys]) => {
      const loanGroups = groupByLoan(contactKeys)
      return { contact, loans: loanGroups }
    })
    .sort((a, b) => a.contact.localeCompare(b.contact, 'sv'))

  return result
}

/**
 * Group keys by specific loan ID
 */
function groupByLoan(keys: KeyWithLoanAndEvent[]): LoanGroup[] {
  const byLoan = keys.reduce(
    (acc, key) => {
      const loanId = key.loan!.id
      if (!acc[loanId]) {
        acc[loanId] = []
      }
      acc[loanId].push(key)
      return acc
    },
    {} as Record<string, KeyWithLoanAndEvent[]>
  )

  const result: LoanGroup[] = Object.entries(byLoan)
    .map(([loanId, loanKeys]) => {
      // Sort keys within this loan by type then name
      const sortedKeys = sortKeysByTypeAndName(loanKeys)
      const loan = loanKeys[0].loan!

      return {
        loanId,
        loanContact: loan.contact || null,
        loanContactPerson: loan.contactPerson || null,
        loanPickedUpAt: loan.pickedUpAt || null,
        loanCreatedAt: loan.createdAt,
        keys: sortedKeys,
      }
    })
    // Sort loans by creation date (newest first)
    .sort((a, b) => {
      if (!a.loanCreatedAt || !b.loanCreatedAt) return 0
      return (
        new Date(b.loanCreatedAt).getTime() -
        new Date(a.loanCreatedAt).getTime()
      )
    })

  return result
}

/**
 * Sort keys by type (alphabetically) then by name (alphabetically)
 */
function sortKeysByTypeAndName(
  keys: KeyWithLoanAndEvent[]
): KeyWithLoanAndEvent[] {
  return keys.sort((a, b) => {
    // First by type
    if (a.keyType !== b.keyType) {
      return a.keyType.localeCompare(b.keyType, 'sv')
    }
    // Then by name
    return a.keyName.localeCompare(b.keyName, 'sv')
  })
}

/**
 * Get a flat array of all keys in the correct display order
 * Useful for iterating through keys in a table
 */
export function getFlattenedKeys(grouped: GroupedKeys): KeyWithLoanAndEvent[] {
  const result: KeyWithLoanAndEvent[] = []

  // Non-disposed loaned keys
  grouped.nonDisposed.loaned.forEach((contactGroup) => {
    contactGroup.loans.forEach((loan) => {
      result.push(...loan.keys)
    })
  })

  // Non-disposed unloaned keys
  result.push(...grouped.nonDisposed.unloaned)

  // Disposed loaned keys
  grouped.disposed.loaned.forEach((contactGroup) => {
    contactGroup.loans.forEach((loan) => {
      result.push(...loan.keys)
    })
  })

  // Disposed unloaned keys
  result.push(...grouped.disposed.unloaned)

  return result
}
