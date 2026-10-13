/**
 * Determines the date from which a rental object is vacant,
 * based on the last debit date, block start date, and block end date.
 * The last debit date comes from the leases, the block from Xpand.
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
