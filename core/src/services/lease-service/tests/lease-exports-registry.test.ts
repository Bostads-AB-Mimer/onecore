import { createLeaseExportRegistry } from '../lease-exports/registry'

const DAY_MS = 24 * 60 * 60 * 1000
const FINISHED_TTL_MS = 7 * DAY_MS

describe('lease export registry', () => {
  let current: Date
  const makeRegistry = () =>
    createLeaseExportRegistry({
      now: () => current,
      finishedTtlMs: FINISHED_TTL_MS,
    })

  beforeEach(() => {
    current = new Date('2026-01-01T10:00:00.000Z')
  })

  it('claims a job for a user as running in the fetching-leases phase', () => {
    const registry = makeRegistry()
    const filters = { status: 'ended' }

    const result = registry.claim('user-a', filters)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.job).toMatchObject({
      userId: 'user-a',
      status: 'running',
      phase: 'fetching-leases',
      filters,
      leaseCount: null,
      startedAt: current,
      finishedAt: null,
      storageKey: null,
      failureReason: null,
    })
    expect(typeof result.job.id).toBe('string')
    expect(result.job.id.length).toBeGreaterThan(0)
  })

  it('rejects a second claim for the same user while one is running', () => {
    const registry = makeRegistry()
    const first = registry.claim('user-a', {})
    if (!first.ok) throw new Error('unreachable')

    const second = registry.claim('user-a', {})

    expect(second).toEqual({
      ok: false,
      err: 'already-running',
      runningId: first.job.id,
    })
  })

  it('lets another user claim while user A runs', () => {
    const registry = makeRegistry()
    registry.claim('user-a', {})

    const b = registry.claim('user-b', {})

    expect(b.ok).toBe(true)
  })

  it('lets a user claim again after the export completes', () => {
    const registry = makeRegistry()
    const first = registry.claim('user-a', {})
    if (!first.ok) throw new Error('unreachable')

    registry.complete(first.job.id, 'exports/fake-key.xlsx')

    const [done] = registry.listForUser('user-a')
    expect(done).toMatchObject({
      status: 'done',
      storageKey: 'exports/fake-key.xlsx',
    })
    expect(registry.claim('user-a', {}).ok).toBe(true)
  })

  it('lets a user claim again after the export fails', () => {
    const registry = makeRegistry()
    const first = registry.claim('user-a', {})
    if (!first.ok) throw new Error('unreachable')

    registry.fail(first.job.id, 'export-failed')

    const [failed] = registry.listForUser('user-a')
    expect(failed).toMatchObject({
      status: 'failed',
      failureReason: 'export-failed',
    })
    expect(registry.claim('user-a', {}).ok).toBe(true)
  })

  it('lists only the user own jobs, newest startedAt first', () => {
    const registry = makeRegistry()
    const first = registry.claim('user-a', { n: '1' })
    if (!first.ok) throw new Error('unreachable')
    registry.complete(first.job.id, 'k1')

    current = new Date('2026-01-01T11:00:00.000Z')
    const second = registry.claim('user-a', { n: '2' })
    if (!second.ok) throw new Error('unreachable')
    registry.complete(second.job.id, 'k2')

    current = new Date('2026-01-01T12:00:00.000Z')
    registry.claim('user-b', {})

    const jobs = registry.listForUser('user-a')
    expect(jobs.map((j) => j.id)).toEqual([second.job.id, first.job.id])
    expect(jobs.every((j) => j.userId === 'user-a')).toBe(true)
  })

  it('drops failed and done jobs older than the TTL but keeps newer ones', () => {
    const registry = makeRegistry()
    const failed = registry.claim('user-a', {})
    if (!failed.ok) throw new Error('unreachable')
    registry.fail(failed.job.id, 'lease-service-warming-up')

    const done = registry.claim('user-a', {})
    if (!done.ok) throw new Error('unreachable')
    registry.complete(done.job.id, 'k')

    current = new Date(current.getTime() + FINISHED_TTL_MS - 1000)
    expect(registry.listForUser('user-a').map((j) => j.id)).toEqual(
      expect.arrayContaining([failed.job.id, done.job.id])
    )

    current = new Date(current.getTime() + 2000)
    const ids = registry.listForUser('user-a').map((j) => j.id)
    expect(ids).not.toContain(failed.job.id)
    expect(ids).not.toContain(done.job.id)
  })

  it('updates phase and leaseCount with setPhase', () => {
    const registry = makeRegistry()
    const claim = registry.claim('user-a', {})
    if (!claim.ok) throw new Error('unreachable')

    registry.setPhase(claim.job.id, 'fetching-contacts', 147312)

    expect(registry.listForUser('user-a')[0]).toMatchObject({
      phase: 'fetching-contacts',
      leaseCount: 147312,
    })
  })
})
