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

// Shared with core, which applies the same rule to apartments.
export { determineVacantFrom } from '@onecore/utilities'
