import { match } from 'ts-pattern'

import { TenfastLease } from './schemas'

export type GetLeasesFilters = {
  status: (
    | 'current'
    | 'upcoming'
    | 'about-to-end'
    | 'ended'
    | 'preliminary-terminated'
  )[]
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
            .with('preliminary-terminated', () => isPreliminaryTerminated(l))
            .exhaustive()
        )
      ),
    []
  )
}

function isCurrentLease(l: TenfastLease, now: Date) {
  return (
    l.startDate < now &&
    (!l.endDate || l.endDate > now) &&
    !isPreliminaryTerminated(l) &&
    !l.cancellation.handledAt
  )
}

function isUpcomingLease(l: TenfastLease, now: Date) {
  return l.startDate >= now
}

function isAboutToEndLease(l: TenfastLease, now: Date) {
  return l.endDate && l.endDate >= now && !!l.cancellation.handledAt
}

function isEndedLease(l: TenfastLease, now: Date) {
  return l.endDate && l.endDate < now
}

export const isPreliminaryTerminated = (lease: TenfastLease): boolean => {
  return !!lease.simplesignTermination?.sentAt && !lease.cancellation.handledAt
}
