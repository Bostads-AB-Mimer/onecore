import { TenfastLease } from './schemas'

export type GetLeasesFilters = {
  status: (
    | 'current'
    | 'upcoming'
    | 'about-to-end'
    | 'ended'
    | 'preliminary-terminated'
    | 'pending-signature'
  )[]
}

const stageToStatus: Record<string, GetLeasesFilters['status'][number]> = {
  Gällande: 'current',
  Kommande: 'upcoming',
  Uppsagt: 'about-to-end',
  Upphört: 'ended',
  'Preliminärt uppsagt': 'preliminary-terminated',
  'Inväntar signering': 'pending-signature',
  'Ej skickat': 'pending-signature',
}

export const filterByStatus = (
  leases: TenfastLease[],
  statuses: GetLeasesFilters['status']
) => {
  return leases.filter((l) => {
    const mappedStatus = stageToStatus[l.stage]
    return mappedStatus !== undefined && statuses.includes(mappedStatus)
  })
}
