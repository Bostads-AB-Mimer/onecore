import { RentalObject } from '@onecore/types'

/**
 * Returns true if the rental object has no active or future block.
 * A block with no end date is considered active if its start date is today or earlier.
 */
export function hasNoActiveBlock(ps: RentalObject): boolean {
  if (!ps.blockStartDate) return true
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const start = new Date(ps.blockStartDate)
  start.setUTCHours(0, 0, 0, 0)
  if (!ps.blockEndDate) {
    // Block with no end date, active if start is today or earlier
    return start > today
  }
  const end = new Date(ps.blockEndDate)
  end.setUTCHours(0, 0, 0, 0)
  // Block is active if today is between start and end (inclusive)
  return today < start || today > end
}

/**
 * Determines the date from which a rental object is vacant,
 * based on the last debit date, block start date, and block end date.
 */
export function determineVacantFrom(
  vacantFromDate?: Date | null,
  blockStartDate?: string | Date | null,
  blockEndDate?: string | Date | null
): Date | undefined {
  const toDate = (d: string | Date | undefined | null) =>
    d ? new Date(d) : undefined

  const lastBlockStartDate = toDate(blockStartDate)
  const lastBlockEndDate = toDate(blockEndDate)
  const lastDebit = toDate(vacantFromDate)
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  let vacantFrom: Date | undefined

  if (lastBlockEndDate && lastBlockEndDate >= today) {
    vacantFrom = new Date(lastBlockEndDate)
    vacantFrom.setUTCDate(vacantFrom.getUTCDate() + 1)
    vacantFrom.setUTCHours(0, 0, 0, 0)
  } else if (lastBlockStartDate && !lastBlockEndDate) {
    vacantFrom = undefined
  } else if (lastDebit) {
    vacantFrom = lastDebit
  } else {
    vacantFrom = today
  }

  return vacantFrom
}
