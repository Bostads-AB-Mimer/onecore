/**
 * Calculate monthly rent from yearly rent rows
 * Based on leasing service implementation in transformations-helper.ts
 */
export const calculateMonthlyRentFromYearRentRows = (
  yearRentRows: Array<{
    yearRent: number | null
    debitFromDate: Date | null
    debitToDate: Date | null
  }>,
  referenceDate?: Date
): number => {
  if (!Array.isArray(yearRentRows) || yearRentRows.length === 0) {
    return 0
  }

  // Use today if no reference date provided
  let refDate = referenceDate ?? new Date()
  refDate.setUTCHours(0, 0, 0, 0)

  // Filter rows where reference date falls within the debit period
  const filteredRows = yearRentRows.filter((r) => {
    const from = r.debitFromDate ? new Date(r.debitFromDate) : null
    const to = r.debitToDate ? new Date(r.debitToDate) : null
    const afterFrom = !from || refDate >= from
    const beforeTo = !to || refDate <= to
    return afterFrom && beforeTo
  })

  // Sum all yearly rent values
  const totalYearRent = filteredRows
    .map((r) =>
      typeof r.yearRent === 'number' && !isNaN(r.yearRent) ? r.yearRent : 0
    )
    .reduce((sum, val) => sum + val, 0)

  // Return monthly rent (yearly / 12)
  return totalYearRent / 12
}

/**
 * Calculate yearly rent from yearly rent rows.
 * Returns the sum of yearly rent values without dividing by 12.
 * This is more accurate than monthlyRent for apartments that don't pay rent all 12 months.
 */
export const calculateYearlyRentFromYearRentRows = (
  yearRentRows: Array<{
    yearRent: number | null
    debitFromDate: Date | null
    debitToDate: Date | null
  }>,
  referenceDate?: Date
): number => {
  if (!Array.isArray(yearRentRows) || yearRentRows.length === 0) {
    return 0
  }

  // Use today if no reference date provided
  let refDate = referenceDate ?? new Date()
  refDate.setUTCHours(0, 0, 0, 0)

  // Filter rows where reference date falls within the debit period
  const filteredRows = yearRentRows.filter((r) => {
    const from = r.debitFromDate ? new Date(r.debitFromDate) : null
    const to = r.debitToDate ? new Date(r.debitToDate) : null
    const afterFrom = !from || refDate >= from
    const beforeTo = !to || refDate <= to
    return afterFrom && beforeTo
  })

  // Sum all yearly rent values (without dividing by 12)
  return filteredRows
    .map((r) =>
      typeof r.yearRent === 'number' && !isNaN(r.yearRent) ? r.yearRent : 0
    )
    .reduce((sum, val) => sum + val, 0)
}

/**
 * Calculate estimated rental loss (hyresbortfall) for a rental block.
 * Uses daily rent × number of days blocked.
 *
 * @param yearlyRent - The yearly rent amount
 * @param fromDate - Start date of the rental block
 * @param toDate - End date of the rental block (null = ongoing, uses today)
 * @returns Estimated rental loss in SEK, or null if cannot calculate
 */
export const calculateEstimatedHyresbortfall = (
  yearlyRent: number,
  fromDate: Date | null,
  toDate: Date | null
): number | null => {
  if (!fromDate || yearlyRent <= 0) return null

  const startDate = new Date(fromDate)
  startDate.setUTCHours(0, 0, 0, 0)

  // Use toDate if set, otherwise use today (for ongoing blocks)
  const endDate = toDate ? new Date(toDate) : new Date()
  endDate.setUTCHours(0, 0, 0, 0)

  // Don't calculate negative periods
  if (endDate < startDate) return null

  // Calculate daily rent from yearly rent
  const dailyRent = yearlyRent / 365

  const msPerDay = 1000 * 60 * 60 * 24
  const daysDiff = (endDate.getTime() - startDate.getTime()) / msPerDay

  return Math.round(dailyRent * daysDiff)
}
