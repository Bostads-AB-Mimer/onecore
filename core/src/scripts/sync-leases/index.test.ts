import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import nock from 'nock'
import config from '../../common/config'
import { syncLeases } from './index'
import * as factory from '../../../test/factories'
import { addEntry, readQueue, FailedRowEntry } from '../shared/failed-sync-queue'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeLeaseEntry = (
  lease: ReturnType<typeof factory.leaseChange.build>,
  error = 'xpand-error'
): FailedRowEntry => ({
  key: `${lease.leaseId}:${lease.action}:${lease.timestamp.toISOString()}`,
  type: 'lease',
  payload: { ...lease, timestamp: lease.timestamp.toISOString() },
  addedAt: new Date().toISOString(),
  lastError: error,
})

// Nock the propertyInfo endpoint to return a "Lägenhet" (in-scope)
const nockPropertyInfo = (rentalObjectId: string) =>
  nock(config.propertyInfoService.url)
    .get(`/rentalPropertyInfo/${rentalObjectId}`)
    .reply(200, { content: factory.rentalPropertyInfo.build() })

// Nock the syncLease (POST /leases/sync) endpoint — success
const nockSyncLease = (leaseId: string) =>
  nock(config.tenantsLeasesService.url)
    .post('/leases/sync')
    .reply(200, { content: { action: 'terminated', leaseId } })

// Nock the getUpdatedLeases (GET /leases/sync) endpoint
const nockGetUpdatedLeases = (
  content: Array<ReturnType<typeof factory.leaseChange.build>>,
  since?: Date | null
) => {
  const interceptor = nock(config.tenantsLeasesService.url).get('/leases/sync')
  if (since) {
    interceptor.query({ since: since.toISOString() })
  } else {
    interceptor.query(true)
  }
  return interceptor.reply(200, {
    content: content.map((c) => ({
      ...c,
      timestamp: c.timestamp.toISOString(),
    })),
  })
}

// Nock send-email (POST /send-email) — capture subjects
const nockSendEmail = (times = 1) => {
  const subjects: string[] = []
  const scope = nock(config.communicationService.url)
    .post('/send-email')
    .times(times)
    .reply(function (_uri, body) {
      // multipart/form-data: extract subject from raw body string
      const raw = typeof body === 'string' ? body : JSON.stringify(body)
      const match = raw.match(/name="subject"\r?\n\r?\n([^\r\n]+)/)
      if (match) subjects.push(match[1])
      return [200, { content: null }]
    })
  return { scope, subjects }
}

// ---------------------------------------------------------------------------
// Test state
// ---------------------------------------------------------------------------

let dir: string
let stateFile: string
let queueFile: string

// Keep a reference to the original xpandSync value so tests can restore it
const originalXpandSync = config.emailAddresses.xpandSync

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sl-'))
  stateFile = path.join(dir, 'last-timestamp.txt')
  queueFile = path.join(dir, 'failed-rows.jsonl')
  // Enable email notifications for tests that need them
  ;(config.emailAddresses as Record<string, string>).xpandSync =
    'sync@example.com'
})

afterEach(async () => {
  ;(config.emailAddresses as Record<string, string>).xpandSync =
    originalXpandSync
  nock.cleanAll()
  await fs.rm(dir, { recursive: true, force: true })
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('syncLeases', () => {
  it('case 1: happy path — queue empty, rows sync, state file advances', async () => {
    const lease = factory.leaseChange.build({
      action: 'terminate',
      timestamp: new Date('2026-05-01T10:00:00.000Z'),
    })

    nockGetUpdatedLeases([lease])
    nockPropertyInfo(lease.rentalObjectId)
    nockSyncLease(lease.leaseId)

    await syncLeases({ stateFile, queueFile })

    // No email sent
    expect(nock.pendingMocks()).toHaveLength(0)

    // Queue still empty
    expect(await readQueue(queueFile)).toHaveLength(0)

    // State file advanced to lease.timestamp
    const written = (await fs.readFile(stateFile, 'utf-8')).trim()
    expect(written).toBe(lease.timestamp.toISOString())
  })

  it('case 2: first failure — row queued + one failure mail sent', async () => {
    const lease = factory.leaseChange.build({
      action: 'terminate',
      timestamp: new Date('2026-05-01T11:00:00.000Z'),
    })

    nockGetUpdatedLeases([lease])
    // propertyInfo returns a non-200 to force failure inside syncLease
    nock(config.propertyInfoService.url)
      .get(`/rentalPropertyInfo/${lease.rentalObjectId}`)
      .reply(500, {})

    const emailScope = nock(config.communicationService.url)
      .post('/send-email')
      .reply(200, { content: null })

    await syncLeases({ stateFile, queueFile })

    // Queue has one entry
    const queue = await readQueue(queueFile)
    expect(queue).toHaveLength(1)
    expect(queue[0].key).toBe(
      `${lease.leaseId}:${lease.action}:${lease.timestamp.toISOString()}`
    )

    // Exactly one email was sent (failure notification)
    expect(emailScope.isDone()).toBe(true)

    // State advanced to that row's timestamp (saveLastTimestamp is called even on failure)
    const written = (await fs.readFile(stateFile, 'utf-8')).trim()
    expect(written).toBe(lease.timestamp.toISOString())
  })

  it('case 3: silent retry — queue has entry, drain fails, no mails sent', async () => {
    const lease = factory.leaseChange.build({
      action: 'terminate',
      timestamp: new Date('2026-05-01T09:00:00.000Z'),
    })

    // Pre-seed the queue
    const entry = makeLeaseEntry(lease)
    await addEntry(queueFile, entry)

    // Drain attempt fails (propertyInfo 500)
    nock(config.propertyInfoService.url)
      .get(`/rentalPropertyInfo/${lease.rentalObjectId}`)
      .reply(500, {})

    // No new cmlog rows
    nockGetUpdatedLeases([])

    // Track that no email is sent
    const emailScope = nock(config.communicationService.url)
      .post('/send-email')
      .reply(200, { content: null })

    await syncLeases({ stateFile, queueFile })

    // Queue unchanged (still has the one entry)
    const queue = await readQueue(queueFile)
    expect(queue).toHaveLength(1)
    expect(queue[0].key).toBe(entry.key)

    // Email interceptor was NOT consumed (no mails sent)
    expect(emailScope.isDone()).toBe(false)
    nock.cleanAll()

    // State file not written (no rows processed)
    await expect(fs.readFile(stateFile, 'utf-8')).rejects.toThrow()
  })

  it('case 4: recovery — queue has entry, drain succeeds, recovery mail sent, state unchanged', async () => {
    const lease = factory.leaseChange.build({
      action: 'terminate',
      timestamp: new Date('2026-05-01T08:00:00.000Z'),
    })

    // Pre-seed the queue
    const entry = makeLeaseEntry(lease)
    await addEntry(queueFile, entry)

    // Drain attempt succeeds
    nockPropertyInfo(lease.rentalObjectId)
    nockSyncLease(lease.leaseId)

    // No new cmlog rows
    nockGetUpdatedLeases([])

    // Expect one recovery email
    const emailScope = nock(config.communicationService.url)
      .post('/send-email')
      .reply(200, { content: null })

    await syncLeases({ stateFile, queueFile })

    // Queue is now empty
    expect(await readQueue(queueFile)).toHaveLength(0)

    // Recovery email was sent
    expect(emailScope.isDone()).toBe(true)

    // State file was NOT written (no new cmlog rows processed)
    await expect(fs.readFile(stateFile, 'utf-8')).rejects.toThrow()
  })

  it('case 5: crash-retry dedupe — pre-queued entry matches incoming row, single queue entry, no duplicate mail', async () => {
    const lease = factory.leaseChange.build({
      action: 'terminate',
      timestamp: new Date('2026-05-01T07:00:00.000Z'),
    })

    // Pre-seed the queue with that same lease key
    const entry = makeLeaseEntry(lease)
    await addEntry(queueFile, entry)

    // Drain attempt fails (propertyInfo 500 for first call)
    nock(config.propertyInfoService.url)
      .get(`/rentalPropertyInfo/${lease.rentalObjectId}`)
      .reply(500, {})

    // New cmlog returns the same lease again
    nockGetUpdatedLeases([lease])

    // New row's sync also fails (second propertyInfo call)
    nock(config.propertyInfoService.url)
      .get(`/rentalPropertyInfo/${lease.rentalObjectId}`)
      .reply(500, {})

    // Expect zero emails (dedupe gate prevents failure mail; no recovery)
    const emailScope = nock(config.communicationService.url)
      .post('/send-email')
      .reply(200, { content: null })

    await syncLeases({ stateFile, queueFile })

    // Queue still has exactly one entry (no duplicate)
    const queue = await readQueue(queueFile)
    expect(queue).toHaveLength(1)
    expect(queue[0].key).toBe(entry.key)

    // No email sent
    expect(emailScope.isDone()).toBe(false)
    nock.cleanAll()

    // State advanced to the row's timestamp
    const written = (await fs.readFile(stateFile, 'utf-8')).trim()
    expect(written).toBe(lease.timestamp.toISOString())
  })
})
