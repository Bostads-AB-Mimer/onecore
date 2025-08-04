export const printVacantFrom = (
  dateFormatter: Intl.DateTimeFormat,
  vacantFrom: string | Date
) => {
  if (new Date(vacantFrom) > new Date())
    return dateFormatter.format(new Date(vacantFrom))
  else return 'Omgående'
}
