/**
 * Determines the date from which a rental object is vacant, from the date the
 * leases give (worked out in leasing) and the block.
 * Without a date from the leases the object is leased until further notice,
 * so it is not vacant whatever the block says. The block comes from Xpand.
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
