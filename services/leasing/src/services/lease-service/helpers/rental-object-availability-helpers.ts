import { RentalObject } from '@onecore/types'

/**
 * Returns true if the rental object has an indefinite block (no end date)
 * that has already started. Such a block has no way to determine a future
 * vacant-from date, so the rental object should be excluded from vacancy
 * listings entirely — unlike a block with an end date, which should still
 * be listed with a computed vacant-from date (see determineVacantFrom).
 */
export function hasIndefiniteActiveBlock(ps: RentalObject): boolean {
  if (!ps.blockStartDate || ps.blockEndDate) return false
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const start = new Date(ps.blockStartDate)
  start.setUTCHours(0, 0, 0, 0)
  // Active if start is today or earlier
  return start <= today
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
    const dayAfterBlock = new Date(lastBlockEndDate)
    dayAfterBlock.setUTCDate(dayAfterBlock.getUTCDate() + 1)
    dayAfterBlock.setUTCHours(0, 0, 0, 0)
    vacantFrom =
      lastDebit && lastDebit > dayAfterBlock ? lastDebit : dayAfterBlock
  } else if (lastBlockStartDate && !lastBlockEndDate) {
    vacantFrom = undefined
  } else if (lastDebit) {
    vacantFrom = lastDebit
  } else {
    vacantFrom = today
  }

  return vacantFrom
}
