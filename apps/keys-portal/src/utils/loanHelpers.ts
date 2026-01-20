import type { KeyDetails, CardDetails, KeyLoan } from '@/services/types'

/**
 * Type for anything that has loans (keys or cards)
 */
type Loanable = KeyDetails | CardDetails

/**
 * Helper to get the active (not returned) loan from loans array
 * Works with both KeyDetails and CardDetails
 */
export function getActiveLoan(item: Loanable): KeyLoan | null {
  if (!item.loans || item.loans.length === 0) return null
  return item.loans.find((loan) => !loan.returnedAt) || null
}

/**
 * Helper to get the previous (most recent returned) loan from loans array
 * Works with both KeyDetails and CardDetails
 */
export function getPreviousLoan(item: Loanable): KeyLoan | null {
  if (!item.loans || item.loans.length === 0) return null
  const returnedLoans = item.loans.filter((loan) => loan.returnedAt)
  if (returnedLoans.length === 0) return null
  return returnedLoans[returnedLoans.length - 1]
}

/**
 * Helper to get the most recent loan by createdAt date
 * Works with both KeyDetails and CardDetails
 */
export function getLatestLoan(item: Loanable): KeyLoan | null {
  if (!item.loans || item.loans.length === 0) return null
  return item.loans.reduce((latest, loan) => {
    if (!latest) return loan
    return new Date(loan.createdAt) > new Date(latest.createdAt) ? loan : latest
  }, null as KeyLoan | null)
}
