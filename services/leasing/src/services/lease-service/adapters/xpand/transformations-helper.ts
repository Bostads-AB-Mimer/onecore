import currency from 'currency.js'

export const calculateMonthlyRentFromYearRentRows = (
  yearRentRows: any[],
  vacantFrom: Date | undefined
): number => {
  if (
    !Array.isArray(yearRentRows) ||
    yearRentRows.length === 0 ||
    !vacantFrom
  ) {
    return 0
  }

  // If vacantFrom is in the past, use today's date to get rent
  if (vacantFrom < new Date()) {
    vacantFrom = new Date()
    vacantFrom.setUTCHours(0, 0, 0, 0)
  }

  const filteredRows = yearRentRows.filter((r: any) => {
    const from = r.debitfdate ? new Date(r.debitfdate) : null
    const to = r.debittodate ? new Date(r.debittodate) : null
    const afterFrom = !from || vacantFrom >= from
    const beforeTo = !to || vacantFrom <= to

    return afterFrom && beforeTo
  })

  const totalYearRent = filteredRows
    .map((r: any) =>
      typeof r.yearrent === 'number' && !isNaN(r.yearrent) ? r.yearrent : 0
    )
    .reduce((sum: number, val: number) => currency(sum).add(val).value, 0)

  return totalYearRent / 12
}
