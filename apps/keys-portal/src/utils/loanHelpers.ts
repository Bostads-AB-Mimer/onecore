import type { KeyDetails, KeyLoan } from '@/services/types'

/**
 * Helper to get the active (not returned) loan from loans array
 */
export function getActiveLoan(key: KeyDetails): KeyLoan | null {
  if (!key.loans || key.loans.length === 0) return null
  return key.loans.find((loan) => !loan.returnedAt) || null
}

/**
 * Helper to get the previous (most recent returned) loan from loans array
 */
export function getPreviousLoan(key: KeyDetails): KeyLoan | null {
  if (!key.loans || key.loans.length === 0) return null
  const returnedLoans = key.loans.filter((loan) => loan.returnedAt)
  if (returnedLoans.length === 0) return null
  return returnedLoans[returnedLoans.length - 1]
}
