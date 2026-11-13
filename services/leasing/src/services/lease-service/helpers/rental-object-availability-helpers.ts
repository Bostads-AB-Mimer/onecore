import {
  RentalObject,
  RentalObjectAvailabilityInfo,
  RentRow,
} from '@onecore/types'
import currency from 'currency.js'

// Rent rows run over whole days and all dates here are UTC midnights, so
// dates are compared by their UTC day. Today is the UTC day too, so in the
// hour or two after Swedish midnight the Swedish day counts as a later day.
// That is harmless: the rent of that day is then summed from the rows, which
// gives the same total as Tenfast's own for the day.
const toUtcDay = (date: Date) => date.toISOString().slice(0, 10)

/**
 * The availability info with the rent total as it will be on the given day,
 * which is the day a new tenant would move in. The total from Tenfast is the
 * rent of today, so a rent row that starts or ends before the move-in is not
 * reflected in it (AVTAL-489).
 *
 * The total is the sum of the rows in force that day that are part of the
 * rent (includedInRent), which is how Tenfast computes its own total. The
 * rows are returned as they are, and rent.asOf says which day the total is
 * the rent of.
 *
 * The total from Tenfast (the rent of today) is kept, with asOf left at
 * today, when:
 * - there is no date, or it is today or earlier
 * - the rows for that day look incomplete, so that a sum would give a rent
 *   that is too low: no row is in force that day, or a charge in force today
 *   has ended by then with no row of the same article taking over. That is
 *   what it looks like when rows end at the turn of the year and the next
 *   year's are not entered yet. A discount (a negative row) that ends is
 *   trusted, since that only raises the rent.
 */
export function withRentAt(
  availabilityInfo: RentalObjectAvailabilityInfo,
  rentAt?: Date
): RentalObjectAvailabilityInfo {
  const today = toUtcDay(new Date())
  if (!rentAt || toUtcDay(rentAt) <= today) return availabilityInfo

  const day = toUtcDay(rentAt)
  const isInForce = (row: RentRow, onDay: string) =>
    (!row.fromDate || toUtcDay(row.fromDate) <= onDay) &&
    (!row.toDate || toUtcDay(row.toDate) >= onDay)

  const includedRows = availabilityInfo.rent.rows.filter(
    (row) => row.includedInRent !== false
  )
  const rowsInForce = includedRows.filter((row) => isInForce(row, day))
  const chargeEndedWithoutSuccessor = includedRows.some(
    (row) =>
      row.amount > 0 &&
      isInForce(row, today) &&
      !isInForce(row, day) &&
      // Taking over means starting after today: several rows can share an
      // article (a rent and its index supplement), and one that is already
      // in force today is a sibling, not a successor.
      !rowsInForce.some(
        (successor) =>
          successor.code === row.code && !isInForce(successor, today)
      )
  )
  if (rowsInForce.length === 0 || chargeEndedWithoutSuccessor)
    return availabilityInfo

  return {
    ...availabilityInfo,
    rent: {
      ...availabilityInfo.rent,
      asOf: new Date(`${day}T00:00:00.000Z`),
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
