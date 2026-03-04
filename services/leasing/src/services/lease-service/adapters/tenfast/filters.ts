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
  return (
    l.stage === 'Gällande' ||
    // TODO START: Remove legacy stage fallbacks once all leases have been migrated to new stage values
    (l.startDate < now && !l.endDate && l.stage === 'signed')
  )
}

const isUpcomingLease = (l: TenfastLease, now: Date) => {
  return (
    l.stage === 'Kommande' ||
    (l.startDate >= now && l.stage === 'signed')
  )
}

const isAboutToEndLease = (l: TenfastLease, now: Date) => {
  return (
    l.stage === 'Uppsagt' ||
    (l.endDate !== null &&
      l.endDate >= now &&
      !isPreliminaryTerminated(l) &&
      !isPendingSignature(l))
  )
}

const isEndedLease = (l: TenfastLease, now: Date) => {
  return (
    l.stage === 'Upphört' ||
    ((l.stage === 'cancelled' || l.stage === 'archived') &&
      l.endDate !== null &&
      l.endDate < now)
  )
}

export const isPreliminaryTerminated = (lease: TenfastLease): boolean => {
  return (
    lease.stage === 'Preliminärt uppsagt' ||
    lease.stage === 'requestedCancellation' ||
    lease.stage === 'preliminaryCancellation'
  )
}

export const isPendingSignature = (lease: TenfastLease): boolean => {
  return (
    lease.stage === 'Inväntar signering' ||
    lease.stage === 'Ej skickat' ||
    lease.stage === 'signingInProgress'
  )
}
// TODO END: Remove legacy stage fallbacks
