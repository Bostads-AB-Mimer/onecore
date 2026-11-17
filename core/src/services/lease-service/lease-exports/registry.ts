import { randomUUID } from 'node:crypto'

import type { LeaseQuery } from '../../../adapters/property-base-adapter/lease-query'

export type LeaseExportPhase =
  'fetching-leases' | 'fetching-contacts' | 'building-file' | 'saving-file'

export type LeaseExportFailureReason =
  'lease-service-warming-up' | 'export-failed'

export type LeaseExportJob = {
  id: string
  userId: string
  status: 'running' | 'done' | 'failed'
  phase: LeaseExportPhase | null
  filters: LeaseQuery
  leaseCount: number | null
  startedAt: Date
  finishedAt: Date | null
  storageKey: string | null
  failureReason: LeaseExportFailureReason | null
}

export type LeaseExportClaimResult =
  | { ok: true; job: LeaseExportJob }
  | { ok: false; err: 'already-running'; runningId: string }

export type LeaseExportRegistry = {
  /** Synchronous reservation — must run before any await on the export path. */
  claim: (userId: string, filters: LeaseQuery) => LeaseExportClaimResult
  setPhase: (id: string, phase: LeaseExportPhase, leaseCount?: number) => void
  complete: (id: string, storageKey: string) => void
  fail: (id: string, reason: LeaseExportFailureReason) => void
  /** Newest first. Drops finished entries older than the TTL. */
  listForUser: (userId: string) => LeaseExportJob[]
  clear: () => void
}

/** In-process registry. Swap for shared storage when Core runs multi-instance. */
export const createLeaseExportRegistry = (opts: {
  now?: () => Date
  finishedTtlMs: number
}): LeaseExportRegistry => {
  const now = opts.now ?? (() => new Date())
  const jobs = new Map<string, LeaseExportJob>()

  const purgeExpiredFinished = () => {
    const cutoff = now().getTime() - opts.finishedTtlMs
    for (const [id, job] of jobs) {
      if (
        job.status !== 'running' &&
        job.finishedAt &&
        job.finishedAt.getTime() <= cutoff
      ) {
        jobs.delete(id)
      }
    }
  }

  return {
    claim(userId, filters) {
      for (const job of jobs.values()) {
        if (job.userId === userId && job.status === 'running') {
          return { ok: false, err: 'already-running', runningId: job.id }
        }
      }

      const job: LeaseExportJob = {
        id: randomUUID(),
        userId,
        status: 'running',
        phase: 'fetching-leases',
        filters,
        leaseCount: null,
        startedAt: now(),
        finishedAt: null,
        storageKey: null,
        failureReason: null,
      }
      jobs.set(job.id, job)
      return { ok: true, job }
    },
    setPhase(id, phase, leaseCount) {
      const job = jobs.get(id)
      if (!job || job.status !== 'running') return
      job.phase = phase
      if (leaseCount !== undefined) job.leaseCount = leaseCount
    },
    complete(id, storageKey) {
      const job = jobs.get(id)
      if (!job || job.status !== 'running') return
      job.status = 'done'
      job.phase = null
      job.storageKey = storageKey
      job.finishedAt = now()
    },
    fail(id, reason) {
      const job = jobs.get(id)
      if (!job || job.status !== 'running') return
      job.status = 'failed'
      job.phase = null
      job.failureReason = reason
      job.finishedAt = now()
    },
    listForUser(userId) {
      purgeExpiredFinished()
      return [...jobs.values()]
        .filter((job) => job.userId === userId)
        .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    },
    clear() {
      jobs.clear()
    },
  }
}

const FINISHED_TTL_MS = 7 * 24 * 60 * 60 * 1000

export const leaseExportRegistry = createLeaseExportRegistry({
  finishedTtlMs: FINISHED_TTL_MS,
})
