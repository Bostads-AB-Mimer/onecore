import { match } from 'ts-pattern'

import { TenfastLease } from './schemas'

export type GetLeasesFilters = {
  status: ('current' | 'upcoming' | 'about-to-end' | 'ended')[]
}

export function filterByStatus(
  leases: TenfastLease[],
  statuses: GetLeasesFilters['status']
) {
  const now = new Date()

  return statuses.reduce<TenfastLease[]>(
    (acc, status) =>
      acc.concat(
        leases.filter((l) =>
          match(status)
            .with('current', () => isCurrentLease(l, now))
            .with('upcoming', () => isUpcomingLease(l, now))
            .with('about-to-end', () => isAboutToEndLease(l, now))
            .with('ended', () => isEndedLease(l, now))
            .exhaustive()
        )
      ),
    []
  )
}

function isCurrentLease(l: TenfastLease, now: Date) {
  return (
    l.startDate < now &&
    !l.cancellation.cancelled &&
    (!l.endDate || (l.endDate && l.endDate > now))
  )
}

function isUpcomingLease(l: TenfastLease, now: Date) {
  return l.startDate >= now
}

function isAboutToEndLease(l: TenfastLease, now: Date) {
  return l.endDate && l.endDate >= now && l.cancellation.cancelled
}

function isEndedLease(l: TenfastLease, now: Date) {
  return l.endDate && l.endDate < now
}
