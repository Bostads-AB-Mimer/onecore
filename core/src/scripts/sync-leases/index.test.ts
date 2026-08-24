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
import * as communicationAdapter from '../../adapters/communication-adapter'
import * as contactsAdapter from '../../adapters/contacts-adapter'
import * as economyAdapter from '../../adapters/economy-adapter'

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

    jest.spyOn(leasingAdapter, 'syncLease').mockResolvedValue({
      ok: true,
      data: { action: 'terminated', leaseId: 'L-1' },
    })

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

    jest.spyOn(leasingAdapter, 'syncLease').mockResolvedValue({
      ok: true,
      data: { action: 'terminated', leaseId: 'L-1' },
    })

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

  it('case 6: create action with otherInvoiceRecipient — synced to economy before lease sync', async () => {
    const lease = factory.leaseChange.build({
      action: 'create',
      timestamp: new Date('2026-05-01T12:00:00.000Z'),
    })

    const otherInvoiceRecipient = {
      contactCode: 'P999999',
      role: 'otherInvoiceRecipient' as const,
      fullName: 'Annan Mottagare',
      firstName: 'Annan',
      lastName: 'Mottagare',
    }

    const contact = factory.contactsServiceContact.build({
      contactCode: lease.contactCode,
      relatedContacts: [otherInvoiceRecipient],
    })

    const getByContactCode = jest
      .fn()
      .mockResolvedValue({ ok: true, data: contact })
    jest
      .spyOn(contactsAdapter, 'makeContactsAdapter')
      .mockReturnValue({ getByContactCode } as any)

    const syncContactToEconomySpy = jest
      .spyOn(economyAdapter, 'syncContactToEconomy')
      .mockResolvedValue({ ok: true, data: { skipped: false } })

    jest
      .spyOn(leasingAdapter, 'getUpdatedLeases')
      .mockResolvedValue({ ok: true, data: [lease] })

    jest
      .spyOn(propertyManagementAdapter, 'getRentalPropertyInfoFromXpand')
      .mockResolvedValue({
        status: 200,
        data: factory.rentalPropertyInfo.build({ type: 'Lägenhet' }),
      })

    const syncLeaseSpy = jest
      .spyOn(leasingAdapter, 'syncLease')
      .mockResolvedValue({
        ok: true,
        data: { action: 'created', leaseId: lease.leaseId },
      })

    await syncLeases({ stateFile, queueFile })

    expect(getByContactCode).toHaveBeenCalledWith(lease.contactCode)
    expect(syncContactToEconomySpy).toHaveBeenCalledWith(
      otherInvoiceRecipient.contactCode,
      otherInvoiceRecipient
    )
    expect(syncLeaseSpy).toHaveBeenCalledWith(
      lease.leaseId,
      lease.contactCode,
      'create'
    )

    // No failures
    expect(await readQueue(queueFile)).toHaveLength(0)
    const written = (await fs.readFile(stateFile, 'utf-8')).trim()
    expect(written).toBe(lease.timestamp.toISOString())
  })

  it('case 7: create action without otherInvoiceRecipient — economy sync skipped', async () => {
    const lease = factory.leaseChange.build({
      action: 'create',
      timestamp: new Date('2026-05-01T13:00:00.000Z'),
    })

    const contact = factory.contactsServiceContact.build({
      contactCode: lease.contactCode,
      relatedContacts: [],
    })

    const getByContactCode = jest
      .fn()
      .mockResolvedValue({ ok: true, data: contact })
    jest
      .spyOn(contactsAdapter, 'makeContactsAdapter')
      .mockReturnValue({ getByContactCode } as any)

    const syncContactToEconomySpy = jest.spyOn(
      economyAdapter,
      'syncContactToEconomy'
    )

    jest
      .spyOn(leasingAdapter, 'getUpdatedLeases')
      .mockResolvedValue({ ok: true, data: [lease] })

    jest
      .spyOn(propertyManagementAdapter, 'getRentalPropertyInfoFromXpand')
      .mockResolvedValue({
        status: 200,
        data: factory.rentalPropertyInfo.build({ type: 'Lägenhet' }),
      })

    jest.spyOn(leasingAdapter, 'syncLease').mockResolvedValue({
      ok: true,
      data: { action: 'created', leaseId: lease.leaseId },
    })

    await syncLeases({ stateFile, queueFile })

    expect(syncContactToEconomySpy).not.toHaveBeenCalled()
    expect(await readQueue(queueFile)).toHaveLength(0)
  })

  it('case 8: terminate action — contact lookup and economy sync skipped entirely', async () => {
    const lease = factory.leaseChange.build({
      action: 'terminate',
      timestamp: new Date('2026-05-01T14:00:00.000Z'),
    })

    const makeContactsAdapterSpy = jest.spyOn(
      contactsAdapter,
      'makeContactsAdapter'
    )
    const syncContactToEconomySpy = jest.spyOn(
      economyAdapter,
      'syncContactToEconomy'
    )

    jest
      .spyOn(leasingAdapter, 'getUpdatedLeases')
      .mockResolvedValue({ ok: true, data: [lease] })

    jest
      .spyOn(propertyManagementAdapter, 'getRentalPropertyInfoFromXpand')
      .mockResolvedValue({
        status: 200,
        data: factory.rentalPropertyInfo.build({ type: 'Lägenhet' }),
      })

    jest.spyOn(leasingAdapter, 'syncLease').mockResolvedValue({
      ok: true,
      data: { action: 'terminated', leaseId: lease.leaseId },
    })

    await syncLeases({ stateFile, queueFile })

    expect(makeContactsAdapterSpy).not.toHaveBeenCalled()
    expect(syncContactToEconomySpy).not.toHaveBeenCalled()
  })

  it('case 9: create action — contact lookup fails, lease queued with error', async () => {
    const lease = factory.leaseChange.build({
      action: 'create',
      timestamp: new Date('2026-05-01T15:00:00.000Z'),
    })

    const getByContactCode = jest
      .fn()
      .mockResolvedValue({ ok: false, err: 'not-found' })
    jest
      .spyOn(contactsAdapter, 'makeContactsAdapter')
      .mockReturnValue({ getByContactCode } as any)

    const syncContactToEconomySpy = jest.spyOn(
      economyAdapter,
      'syncContactToEconomy'
    )

    jest
      .spyOn(leasingAdapter, 'getUpdatedLeases')
      .mockResolvedValue({ ok: true, data: [lease] })

    jest
      .spyOn(propertyManagementAdapter, 'getRentalPropertyInfoFromXpand')
      .mockResolvedValue({
        status: 200,
        data: factory.rentalPropertyInfo.build({ type: 'Lägenhet' }),
      })

    const sendEmailSpy = jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockResolvedValue({ ok: true, data: null })

    await syncLeases({ stateFile, queueFile })

    expect(syncContactToEconomySpy).not.toHaveBeenCalled()

    const queue = await readQueue(queueFile)
    expect(queue).toHaveLength(1)
    expect(queue[0].lastError).toMatch(
      `Failed to get contact ${lease.contactCode} for lease ${lease.leaseId}`
    )
    expect(sendEmailSpy).toHaveBeenCalledTimes(1)
  })

  it('case 10: create action — economy sync fails, lease queued with error', async () => {
    const lease = factory.leaseChange.build({
      action: 'create',
      timestamp: new Date('2026-05-01T16:00:00.000Z'),
    })

    const otherInvoiceRecipient = {
      contactCode: 'P999998',
      role: 'otherInvoiceRecipient' as const,
      fullName: 'Annan Mottagare',
      firstName: 'Annan',
      lastName: 'Mottagare',
    }

    const contact = factory.contactsServiceContact.build({
      contactCode: lease.contactCode,
      relatedContacts: [otherInvoiceRecipient],
    })

    const getByContactCode = jest
      .fn()
      .mockResolvedValue({ ok: true, data: contact })
    jest
      .spyOn(contactsAdapter, 'makeContactsAdapter')
      .mockReturnValue({ getByContactCode } as any)

    jest
      .spyOn(economyAdapter, 'syncContactToEconomy')
      .mockResolvedValue({ ok: false, err: 'sync-failed', statusCode: 500 })

    jest
      .spyOn(leasingAdapter, 'getUpdatedLeases')
      .mockResolvedValue({ ok: true, data: [lease] })

    jest
      .spyOn(propertyManagementAdapter, 'getRentalPropertyInfoFromXpand')
      .mockResolvedValue({
        status: 200,
        data: factory.rentalPropertyInfo.build({ type: 'Lägenhet' }),
      })

    const syncLeaseSpy = jest.spyOn(leasingAdapter, 'syncLease')

    const sendEmailSpy = jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockResolvedValue({ ok: true, data: null })

    await syncLeases({ stateFile, queueFile })

    // Lease sync never reached — economy sync failure short-circuits
    expect(syncLeaseSpy).not.toHaveBeenCalled()

    const queue = await readQueue(queueFile)
    expect(queue).toHaveLength(1)
    expect(queue[0].lastError).toMatch(
      `Failed to sync other invoice recipient ${otherInvoiceRecipient.contactCode}`
    )
    expect(sendEmailSpy).toHaveBeenCalledTimes(1)
  })
})
