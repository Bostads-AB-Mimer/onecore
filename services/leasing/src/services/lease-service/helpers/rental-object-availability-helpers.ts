import { RentalObject, RentalObjectAvailabilityInfo } from '@onecore/types'
import currency from 'currency.js'

// Rent rows run over whole days and all dates here are UTC midnights, so
// dates are compared by their UTC day.
const toUtcDay = (date: Date) => date.toISOString().slice(0, 10)

/**
 * The availability info with the rent total as it will be on the given day,
 * which is the day a new tenant would move in. The total from Tenfast is the
 * rent of today, so a rent row that starts or ends before the move-in is not
 * reflected in it (AVTAL-489).
 *
 * The total is the sum of the rows in force that day that are part of the
 * rent (includedInRent), which is how Tenfast computes its own total. Without
 * a date, or for today or earlier, the total from Tenfast is kept. So it is
 * when no row is in force that day, such as when the rows end at the turn of
 * the year and the next year's are not entered yet: the rent of today is then
 * the best one known, where a sum would say the rent is 0. The rows are
 * returned as they are.
 */
export function withRentAt(
  availabilityInfo: RentalObjectAvailabilityInfo,
  rentAt?: Date
): RentalObjectAvailabilityInfo {
  if (!rentAt || toUtcDay(rentAt) <= toUtcDay(new Date()))
    return availabilityInfo

  const day = toUtcDay(rentAt)
  const rowsInForce = availabilityInfo.rent.rows.filter(
    (row) =>
      row.includedInRent !== false &&
      (!row.fromDate || toUtcDay(row.fromDate) <= day) &&
      (!row.toDate || toUtcDay(row.toDate) >= day)
  )
  if (rowsInForce.length === 0) return availabilityInfo

  return {
    ...availabilityInfo,
    rent: {
      ...availabilityInfo.rent,
      amount: rowsInForce.reduce(
        (total, row) => total.add(row.amount),
        currency(0)
      ).value,
      // The part of each row that is VAT. Zero when the rows are without VAT
      // (vatPercentage 0), which is how every route asks for them.
      vat: rowsInForce.reduce(
        (total, row) =>
          total.add(
            currency(row.amount).subtract(
              currency(row.amount).divide(1 + row.vatPercentage)
            )
          ),
        currency(0)
      ).value,
    },
  }
}

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
 * Determines the date from which a rental object is vacant, from the date the
 * leases give (see mapTenfastRentalObjectToAvailabilityInfo) and the block.
 * Without a date from the leases the object is leased until further notice,
 * so it is not vacant whatever the block says.
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
  const leaseVacantFrom = toDate(vacantFromDate)
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  if (!leaseVacantFrom) return undefined

  let vacantFrom: Date | undefined

  if (lastBlockEndDate && lastBlockEndDate >= today) {
    const dayAfterBlock = new Date(lastBlockEndDate)
    dayAfterBlock.setUTCDate(dayAfterBlock.getUTCDate() + 1)
    dayAfterBlock.setUTCHours(0, 0, 0, 0)
    vacantFrom =
      leaseVacantFrom > dayAfterBlock ? leaseVacantFrom : dayAfterBlock
  } else if (lastBlockStartDate && !lastBlockEndDate) {
    vacantFrom = undefined
  } else {
    vacantFrom = leaseVacantFrom
  }

  return vacantFrom
}
