import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import config from '../../common/config'
import { syncLeases } from './index'
import * as factory from '../../../test/factories'
import {
  addEntry,
  readQueue,
  FailedRowEntry,
} from '../shared/failed-sync-queue'
import * as leasingAdapter from '../../adapters/leasing-adapter'
import * as propertyManagementAdapter from '../../adapters/property-management-adapter'
import * as contactsAdapterModule from '../../adapters/contacts-adapter'
import * as communicationAdapter from '../../adapters/communication-adapter'

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

// ---------------------------------------------------------------------------
// Test state
// ---------------------------------------------------------------------------

let dir: string
let stateFile: string
let queueFile: string

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
  jest.clearAllMocks()
  jest.resetAllMocks()
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

    jest
      .spyOn(leasingAdapter, 'getUpdatedLeases')
      .mockResolvedValue({ ok: true, data: [lease] })

    jest
      .spyOn(propertyManagementAdapter, 'getRentalPropertyInfoFromXpand')
      .mockResolvedValue({
        status: 200,
        data: factory.rentalPropertyInfo.build({ type: 'Lägenhet' }),
      })

    jest
      .spyOn(leasingAdapter, 'syncLease')
      .mockResolvedValue({ ok: true, data: { action: 'terminated' } })

    const sendEmailSpy = jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockResolvedValue({ ok: true, data: null })

    await syncLeases({ stateFile, queueFile })

    // No email sent
    expect(sendEmailSpy).not.toHaveBeenCalled()

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

    jest
      .spyOn(leasingAdapter, 'getUpdatedLeases')
      .mockResolvedValue({ ok: true, data: [lease] })

    // propertyInfo returns non-200 to force failure inside syncLease
    jest
      .spyOn(propertyManagementAdapter, 'getRentalPropertyInfoFromXpand')
      .mockResolvedValue({ status: 500, data: undefined })

    const sendEmailSpy = jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockResolvedValue({ ok: true, data: null })

    await syncLeases({ stateFile, queueFile })

    // Queue has one entry
    const queue = await readQueue(queueFile)
    expect(queue).toHaveLength(1)
    expect(queue[0].key).toBe(
      `${lease.leaseId}:${lease.action}:${lease.timestamp.toISOString()}`
    )

    // Exactly one failure email was sent
    expect(sendEmailSpy).toHaveBeenCalledTimes(1)
    expect(sendEmailSpy.mock.calls[0][0].subject).toMatch(
      `sync-leases: nytt fel på avtal ${lease.leaseId}`
    )

    // State advanced to that row's timestamp
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
    jest
      .spyOn(propertyManagementAdapter, 'getRentalPropertyInfoFromXpand')
      .mockResolvedValue({ status: 500, data: undefined })

    // No new cmlog rows
    jest
      .spyOn(leasingAdapter, 'getUpdatedLeases')
      .mockResolvedValue({ ok: true, data: [] })

    const sendEmailSpy = jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockResolvedValue({ ok: true, data: null })

    await syncLeases({ stateFile, queueFile })

    // Queue unchanged (still has the one entry)
    const queue = await readQueue(queueFile)
    expect(queue).toHaveLength(1)
    expect(queue[0].key).toBe(entry.key)

    // No email sent (silent retry)
    expect(sendEmailSpy).not.toHaveBeenCalled()

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
    jest
      .spyOn(propertyManagementAdapter, 'getRentalPropertyInfoFromXpand')
      .mockResolvedValue({
        status: 200,
        data: factory.rentalPropertyInfo.build({ type: 'Lägenhet' }),
      })

    jest
      .spyOn(leasingAdapter, 'syncLease')
      .mockResolvedValue({ ok: true, data: { action: 'terminated' } })

    // No new cmlog rows
    jest
      .spyOn(leasingAdapter, 'getUpdatedLeases')
      .mockResolvedValue({ ok: true, data: [] })

    const sendEmailSpy = jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockResolvedValue({ ok: true, data: null })

    await syncLeases({ stateFile, queueFile })

    // Queue is now empty
    expect(await readQueue(queueFile)).toHaveLength(0)

    // Recovery email was sent
    expect(sendEmailSpy).toHaveBeenCalledTimes(1)
    expect(sendEmailSpy.mock.calls[0][0].subject).toMatch(
      `sync-leases: tidigare felande avtal ${lease.leaseId} är nu synkat`
    )

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

    // Drain attempt fails, then new row attempt also fails
    jest
      .spyOn(propertyManagementAdapter, 'getRentalPropertyInfoFromXpand')
      .mockResolvedValue({ status: 500, data: undefined })

    // New cmlog returns the same lease again
    jest
      .spyOn(leasingAdapter, 'getUpdatedLeases')
      .mockResolvedValue({ ok: true, data: [lease] })

    const sendEmailSpy = jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockResolvedValue({ ok: true, data: null })

    await syncLeases({ stateFile, queueFile })

    // Queue still has exactly one entry (no duplicate)
    const queue = await readQueue(queueFile)
    expect(queue).toHaveLength(1)
    expect(queue[0].key).toBe(entry.key)

    // No email sent (dedupe gate prevents failure mail; no recovery)
    expect(sendEmailSpy).not.toHaveBeenCalled()

    // State advanced to the row's timestamp
    const written = (await fs.readFile(stateFile, 'utf-8')).trim()
    expect(written).toBe(lease.timestamp.toISOString())
  })
})
