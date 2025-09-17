import { ListingStatus } from '@onecore/types'

export const printVacantFrom = (
  dateFormatter: Intl.DateTimeFormat,
  vacantFrom?: string | Date
) => {
  if (!vacantFrom) return '(Saknas - spärr)'
  else if (new Date(vacantFrom) > new Date())
    return dateFormatter.format(new Date(vacantFrom))
  else return 'Omgående'
}

export const printListingStatus = (status: ListingStatus) => {
  if (status === 1) return 'Publicerad'
  else if (status === 2 || status === 3) return 'Historik'
  else if (status === 4) return 'Erbjuden'
  else return ''
}
