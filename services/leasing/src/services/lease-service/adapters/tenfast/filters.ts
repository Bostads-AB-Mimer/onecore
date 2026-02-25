import { match } from 'ts-pattern'

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

export const filterByStatus = (
  leases: TenfastLease[],
  statuses: GetLeasesFilters['status']
) => {
  const now = new Date()
  const seenIds = new Set<string>()

  return statuses.reduce<TenfastLease[]>(
    (acc, status) =>
      acc.concat(
        leases.filter((l) => {
          // Skip if we've already included this lease (by externalId/leaseId)
          if (seenIds.has(l.externalId)) return false

          const matches = match(status)
            .with('current', () => isCurrentLease(l, now))
            .with('upcoming', () => isUpcomingLease(l, now))
            .with('about-to-end', () => isAboutToEndLease(l, now))
            .with('ended', () => isEndedLease(l, now))
            .with('preliminary-terminated', () => isPreliminaryTerminated(l))
            .with('pending-signature', () => isPendingSignature(l))
            .exhaustive()

          if (matches) {
            seenIds.add(l.externalId)
            return true
          }
          return false
        })
      ),
    []
  )
}

const isCurrentLease = (l: TenfastLease, now: Date) => {
  return l.startDate < now && !l.endDate && l.stage === 'signed'
}

const isUpcomingLease = (l: TenfastLease, now: Date) => {
  return l.startDate >= now && l.stage === 'signed'
}

const isAboutToEndLease = (l: TenfastLease, now: Date) => {
  return l.endDate !== null && l.endDate >= now
}

const isEndedLease = (l: TenfastLease, now: Date) => {
  return (
    (l.stage === 'cancelled' || l.stage === 'archived') &&
    l.endDate !== null &&
    l.endDate < now
  )
}

export const isPreliminaryTerminated = (lease: TenfastLease): boolean => {
  return (
    lease.stage === 'requestedCancellation' ||
    lease.stage === 'preliminaryCancellation'
  )
}

// TODO: Verify that acceptedByHyresgast and start actually means pending signature.
export const isPendingSignature = (lease: TenfastLease): boolean => {
  return (
    lease.stage === 'signingInProgress' ||
    lease.stage === 'acceptedByHyresgast' ||
    lease.stage === 'start'
  )
}
