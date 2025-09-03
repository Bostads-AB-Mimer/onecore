export const printVacantFrom = (
  dateFormatter: Intl.DateTimeFormat,
  vacantFrom?: string | Date
) => {
  if (!vacantFrom) return '(Saknas - spärr)'
  else if (new Date(vacantFrom) > new Date())
    return dateFormatter.format(new Date(vacantFrom))
  else return 'Omgående'
}
