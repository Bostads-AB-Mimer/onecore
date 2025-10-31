import type { KeyWithMaintenanceLoanStatus } from '@/services/types'

/**
 * Grouped key structure for display
 */
export interface GroupedKeys {
  nonDisposed: DisposedGroup
  disposed: DisposedGroup
}

export interface DisposedGroup {
  loaned: LoanedGroup[]
  unloaned: KeyWithMaintenanceLoanStatus[]
}

export interface LoanedGroup {
  company: string
  loans: LoanGroup[]
}

export interface LoanGroup {
  loanId: string
  loanCompany: string | null
  loanContactPerson: string | null
  loanPickedUpAt: string | null
  loanCreatedAt: string | null
  keys: KeyWithMaintenanceLoanStatus[]
}

/**
 * Group and sort keys according to the hierarchy:
 * 1. Disposed status (non-disposed first, then disposed)
 * 2. Loan status (loaned first, then unloaned)
 * 3. Company (within loaned keys)
 * 4. Specific loan (within each company)
 * 5. Key type (within each loan or unloaned section)
 * 6. Key name (within each type)
 */
export function groupAndSortKeys(
  keys: KeyWithMaintenanceLoanStatus[]
): GroupedKeys {
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
 * Split into loaned vs unloaned, then group loaned by company and loan
 */
function processDisposedGroup(
  keys: KeyWithMaintenanceLoanStatus[]
): DisposedGroup {
  // 2. Secondary split: loaned vs unloaned
  const loanedKeys = keys.filter((k) => k.maintenanceLoan !== null)
  const unloanedKeys = keys.filter((k) => k.maintenanceLoan === null)

  // 3. Group loaned keys by company
  const loanedByCompany = groupByCompany(loanedKeys)

  // Sort unloaned keys by type then name
  const sortedUnloaned = sortKeysByTypeAndName(unloanedKeys)

  return {
    loaned: loanedByCompany,
    unloaned: sortedUnloaned,
  }
}

/**
 * Group loaned keys by company, then by specific loan
 */
function groupByCompany(keys: KeyWithMaintenanceLoanStatus[]): LoanedGroup[] {
  // Group by company
  const byCompany = keys.reduce(
    (acc, key) => {
      const company = key.maintenanceLoan?.company || 'Okänt företag'
      if (!acc[company]) {
        acc[company] = []
      }
      acc[company].push(key)
      return acc
    },
    {} as Record<string, KeyWithMaintenanceLoanStatus[]>
  )

  // For each company, group by specific loan
  const result: LoanedGroup[] = Object.entries(byCompany)
    .map(([company, companyKeys]) => {
      const loanGroups = groupByLoan(companyKeys)
      return { company, loans: loanGroups }
    })
    .sort((a, b) => a.company.localeCompare(b.company, 'sv'))

  return result
}

/**
 * Group keys by specific loan ID
 */
function groupByLoan(keys: KeyWithMaintenanceLoanStatus[]): LoanGroup[] {
  const byLoan = keys.reduce(
    (acc, key) => {
      const loanId = key.maintenanceLoan!.id
      if (!acc[loanId]) {
        acc[loanId] = []
      }
      acc[loanId].push(key)
      return acc
    },
    {} as Record<string, KeyWithMaintenanceLoanStatus[]>
  )

  const result: LoanGroup[] = Object.entries(byLoan)
    .map(([loanId, loanKeys]) => {
      // Sort keys within this loan by type then name
      const sortedKeys = sortKeysByTypeAndName(loanKeys)
      const loan = loanKeys[0].maintenanceLoan!

      return {
        loanId,
        loanCompany: loan.company,
        loanContactPerson: loan.contactPerson,
        loanPickedUpAt: loan.pickedUpAt,
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
  keys: KeyWithMaintenanceLoanStatus[]
): KeyWithMaintenanceLoanStatus[] {
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
export function getFlattenedKeys(
  grouped: GroupedKeys
): KeyWithMaintenanceLoanStatus[] {
  const result: KeyWithMaintenanceLoanStatus[] = []

  // Non-disposed loaned keys
  grouped.nonDisposed.loaned.forEach((companyGroup) => {
    companyGroup.loans.forEach((loan) => {
      result.push(...loan.keys)
    })
  })

  // Non-disposed unloaned keys
  result.push(...grouped.nonDisposed.unloaned)

  // Disposed loaned keys
  grouped.disposed.loaned.forEach((companyGroup) => {
    companyGroup.loans.forEach((loan) => {
      result.push(...loan.keys)
    })
  })

  // Disposed unloaned keys
  result.push(...grouped.disposed.unloaned)

  return result
}
