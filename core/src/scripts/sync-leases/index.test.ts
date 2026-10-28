import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import config from '../../common/config'
import { syncLeases } from './index'
import * as factory from '../../../test/factories'
import {
  appendEntry,
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

    const propertyInfoSpy = jest
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

    expect(propertyInfoSpy).toHaveBeenCalledWith(lease.rentalObjectId, {
      timeoutMs: 30_000,
    })
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

  it('the give-up mail asks for the change to be made in Tenfast by hand', async () => {
    const lease = factory.leaseChange.build({
      action: 'terminate',
      timestamp: new Date('2026-05-01T09:00:00.000Z'),
    })
    const monthAgo = new Date(
      Date.now() - 31 * 24 * 60 * 60 * 1000
    ).toISOString()
    await appendEntry(queueFile, {
      ...makeLeaseEntry(lease),
      addedAt: monthAgo,
      lastAttemptAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      stillFailingNotifiedAt: monthAgo,
    })
    jest
      .spyOn(propertyManagementAdapter, 'getRentalPropertyInfoFromXpand')
      .mockResolvedValue({ status: 500, data: undefined })
    jest
      .spyOn(leasingAdapter, 'getUpdatedLeases')
      .mockResolvedValue({ ok: true, data: [] })
    const sendEmailSpy = jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockResolvedValue({ ok: true, data: null })

    await syncLeases({ stateFile, queueFile })

    expect(await readQueue(queueFile)).toEqual([])
    const body = sendEmailSpy.mock.calls[0][0].body as string
    expect(body).toContain('i Tenfast för hand')
    expect(body).not.toContain('Gör ändringen i Xpand på nytt')
  })

  it('case 3: silent retry — queue has entry, drain fails, no mails sent', async () => {
    const lease = factory.leaseChange.build({
      action: 'terminate',
      timestamp: new Date('2026-05-01T09:00:00.000Z'),
    })

    // Pre-seed the queue
    const entry = makeLeaseEntry(lease)
    await appendEntry(queueFile, entry)

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
    await appendEntry(queueFile, entry)

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
    await appendEntry(queueFile, entry)

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
    const otherInvoiceRecipientContact = factory.contactsServiceContact.build({
      contactCode: otherInvoiceRecipient.contactCode,
    })

    const getByContactCode = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, data: contact })
      .mockResolvedValueOnce({ ok: true, data: otherInvoiceRecipientContact })
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
      otherInvoiceRecipientContact.contactCode,
      {
        fullName: otherInvoiceRecipientContact.personal.fullName,
        street: otherInvoiceRecipientContact.addresses[0].street,
        zipCode: otherInvoiceRecipientContact.addresses[0].zipCode,
        city: otherInvoiceRecipientContact.addresses[0].city,
        emailAddress:
          otherInvoiceRecipientContact.communication.emailAddresses[0]
            .emailAddress,
      },
      { create: true }
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
      `Failed to sync other invoice recipient ${otherInvoiceRecipient.contactCode} for lease ${lease.leaseId}: sync-failed`
    )
    expect(sendEmailSpy).toHaveBeenCalledTimes(1)
  })

  it('case 11: terminate for a lease whose create is queued — held, not synced, no mail', async () => {
    const create = factory.leaseChange.build({
      leaseId: 'L-1',
      action: 'create',
      timestamp: new Date('2026-05-01T10:00:00.000Z'),
    })
    const terminate = factory.leaseChange.build({
      leaseId: 'L-1',
      action: 'terminate',
      timestamp: new Date('2026-05-01T11:00:00.000Z'),
    })
    await appendEntry(queueFile, makeLeaseEntry(create))

    jest
      .spyOn(leasingAdapter, 'getUpdatedLeases')
      .mockResolvedValue({ ok: true, data: [terminate] })
    // The queued create still fails on its property lookup
    jest
      .spyOn(propertyManagementAdapter, 'getRentalPropertyInfoFromXpand')
      .mockResolvedValue({ status: 500, data: undefined })
    const syncLeaseSpy = jest.spyOn(leasingAdapter, 'syncLease')
    const sendEmailSpy = jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockResolvedValue({ ok: true, data: null })

    await syncLeases({ stateFile, queueFile })

    expect(syncLeaseSpy).not.toHaveBeenCalled()
    const queue = await readQueue(queueFile)
    expect(queue.map((e) => e.key)).toEqual([
      'L-1:create:2026-05-01T10:00:00.000Z',
      'L-1:terminate:2026-05-01T11:00:00.000Z',
    ])
    expect(queue[1].heldBehind).toBe('L-1:create:2026-05-01T10:00:00.000Z')
    expect(sendEmailSpy).not.toHaveBeenCalled()
  })

  it('case 12: terminate synced but Xpand has no uppsägning PDF — one mail, row not queued', async () => {
    const lease = factory.leaseChange.build({
      leaseId: 'L-1',
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
      data: { action: 'terminated', leaseId: 'L-1', document: 'missing' },
    })
    const sendEmailSpy = jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockResolvedValue({ ok: true, data: null })

    await syncLeases({ stateFile, queueFile })

    expect(await readQueue(queueFile)).toHaveLength(0)
    expect(sendEmailSpy).toHaveBeenCalledTimes(1)
    expect(sendEmailSpy.mock.calls[0][0].subject).toBe(
      'sync-leases: avtal L-1 saknar uppsägningsdokument i Xpand'
    )
    expect(sendEmailSpy.mock.calls[0][0].body).toContain(
      'Lägg till dokumentet i Tenfast för hand.'
    )
  })

  it('case 13: a failed uppsägning PDF step fails the row with the service error in the queue', async () => {
    const lease = factory.leaseChange.build({
      leaseId: 'L-1',
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
      ok: false,
      err: 'sync-failed',
      statusCode: 500,
      detail: 'termination-pdf-upload-failed',
    })
    jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockResolvedValue({ ok: true, data: null })

    await syncLeases({ stateFile, queueFile })

    const queue = await readQueue(queueFile)
    expect(queue).toHaveLength(1)
    expect(queue[0].lastError).toBe(
      'Failed to sync lease L-1: sync-failed (termination-pdf-upload-failed)'
    )
  })

  it('case 14: create synced but the contract PDF failed — one mail, row not queued', async () => {
    const lease = factory.leaseChange.build({
      leaseId: 'L-1',
      action: 'create',
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
    const getByContactCode = jest.fn().mockResolvedValue({
      ok: true,
      data: factory.contactsServiceContact.build({ relatedContacts: [] }),
    })
    jest
      .spyOn(contactsAdapter, 'makeContactsAdapter')
      .mockReturnValue({ getByContactCode } as any)
    jest.spyOn(leasingAdapter, 'syncLease').mockResolvedValue({
      ok: true,
      data: {
        action: 'created',
        leaseId: 'L-1',
        document: 'failed',
        documentError: 'contract-pdf-upload-failed',
      },
    })
    const sendEmailSpy = jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockResolvedValue({ ok: true, data: null })

    await syncLeases({ stateFile, queueFile })

    expect(await readQueue(queueFile)).toHaveLength(0)
    expect(sendEmailSpy).toHaveBeenCalledTimes(1)
    expect(sendEmailSpy.mock.calls[0][0].subject).toBe(
      'sync-leases: signerat kontrakt kunde inte bifogas till avtal L-1'
    )
    expect(sendEmailSpy.mock.calls[0][0].body).toContain(
      'contract-pdf-upload-failed'
    )
    expect(sendEmailSpy.mock.calls[0][0].body).toContain(
      'Bifoga kontraktet i Tenfast för hand.'
    )
  })

  it('the give-up mail for a failed uppsägning PDF says the lease is already terminated', async () => {
    const lease = factory.leaseChange.build({
      action: 'terminate',
      timestamp: new Date('2026-05-01T09:00:00.000Z'),
    })
    const monthAgo = new Date(
      Date.now() - 31 * 24 * 60 * 60 * 1000
    ).toISOString()
    await appendEntry(queueFile, {
      ...makeLeaseEntry(
        lease,
        `Failed to sync lease ${lease.leaseId}: sync-failed (termination-pdf-upload-failed)`
      ),
      addedAt: monthAgo,
      lastAttemptAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      stillFailingNotifiedAt: monthAgo,
    })
    jest
      .spyOn(propertyManagementAdapter, 'getRentalPropertyInfoFromXpand')
      .mockResolvedValue({
        status: 200,
        data: factory.rentalPropertyInfo.build({ type: 'Lägenhet' }),
      })
    jest.spyOn(leasingAdapter, 'syncLease').mockResolvedValue({
      ok: false,
      err: 'sync-failed',
      statusCode: 500,
      detail: 'termination-pdf-upload-failed',
    })
    jest
      .spyOn(leasingAdapter, 'getUpdatedLeases')
      .mockResolvedValue({ ok: true, data: [] })
    const sendEmailSpy = jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockResolvedValue({ ok: true, data: null })

    await syncLeases({ stateFile, queueFile })

    const body = sendEmailSpy.mock.calls[0][0].body as string
    expect(body).toContain('är uppsagt i Tenfast')
    expect(body).toContain('Bifoga det i Tenfast för hand.')
    expect(body).not.toContain('Ändringen har inte nått Tenfast')
  })

  it('the give-up mail for a mismatched end date tells staff to set it in Tenfast', async () => {
    const lease = factory.leaseChange.build({
      action: 'terminate',
      timestamp: new Date('2026-05-01T09:00:00.000Z'),
    })
    const monthAgo = new Date(
      Date.now() - 31 * 24 * 60 * 60 * 1000
    ).toISOString()
    await appendEntry(queueFile, {
      ...makeLeaseEntry(
        lease,
        `Failed to sync lease ${lease.leaseId}: sync-failed (end-date-mismatch)`
      ),
      addedAt: monthAgo,
      lastAttemptAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      stillFailingNotifiedAt: monthAgo,
    })
    jest
      .spyOn(propertyManagementAdapter, 'getRentalPropertyInfoFromXpand')
      .mockResolvedValue({
        status: 200,
        data: factory.rentalPropertyInfo.build({ type: 'Lägenhet' }),
      })
    jest.spyOn(leasingAdapter, 'syncLease').mockResolvedValue({
      ok: false,
      err: 'sync-failed',
      statusCode: 500,
      detail: 'end-date-mismatch',
    })
    jest
      .spyOn(leasingAdapter, 'getUpdatedLeases')
      .mockResolvedValue({ ok: true, data: [] })
    const sendEmailSpy = jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockResolvedValue({ ok: true, data: null })

    await syncLeases({ stateFile, queueFile })

    const body = sendEmailSpy.mock.calls[0][0].body as string
    expect(body).toContain('sista debiteringsdag i Xpand')
    expect(body).not.toContain('Ändringen har inte nått Tenfast')
  })

  it('a later void replaces a queued terminate for the same lease', async () => {
    const terminate = factory.leaseChange.build({
      leaseId: 'L-1',
      action: 'terminate',
      timestamp: new Date('2026-05-01T09:00:00.000Z'),
    })
    const voidChange = factory.leaseChange.build({
      leaseId: 'L-1',
      action: 'void',
      timestamp: new Date('2026-05-01T10:00:00.000Z'),
    })
    await appendEntry(queueFile, makeLeaseEntry(terminate))
    jest
      .spyOn(leasingAdapter, 'getUpdatedLeases')
      .mockResolvedValue({ ok: true, data: [voidChange] })
    jest
      .spyOn(propertyManagementAdapter, 'getRentalPropertyInfoFromXpand')
      .mockResolvedValue({
        status: 200,
        data: factory.rentalPropertyInfo.build({ type: 'Lägenhet' }),
      })
    const syncLease = jest
      .spyOn(leasingAdapter, 'syncLease')
      .mockResolvedValue({
        ok: true,
        data: { action: 'voided', leaseId: 'L-1' },
      })
    jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockResolvedValue({ ok: true, data: null })

    await syncLeases({ stateFile, queueFile })

    expect(syncLease).toHaveBeenCalledTimes(1)
    expect(syncLease).toHaveBeenCalledWith('L-1', undefined, 'void')
    expect(await readQueue(queueFile)).toEqual([])
  })

  it('a later terminate does not replace a queued create for the same lease', async () => {
    const create = factory.leaseChange.build({
      leaseId: 'L-1',
      action: 'create',
      timestamp: new Date('2026-05-01T09:00:00.000Z'),
    })
    const terminate = factory.leaseChange.build({
      leaseId: 'L-1',
      action: 'terminate',
      timestamp: new Date('2026-05-01T10:00:00.000Z'),
    })
    await appendEntry(queueFile, makeLeaseEntry(create))
    jest
      .spyOn(leasingAdapter, 'getUpdatedLeases')
      .mockResolvedValue({ ok: true, data: [terminate] })
    jest
      .spyOn(propertyManagementAdapter, 'getRentalPropertyInfoFromXpand')
      .mockResolvedValue({
        status: 200,
        data: factory.rentalPropertyInfo.build({ type: 'Lägenhet' }),
      })
    jest.spyOn(contactsAdapter, 'makeContactsAdapter').mockReturnValue({
      getByContactCode: jest.fn().mockResolvedValue({
        ok: true,
        data: factory.contactsServiceContact.build({ relatedContacts: [] }),
      }),
    } as any)
    const syncLease = jest
      .spyOn(leasingAdapter, 'syncLease')
      .mockResolvedValue({
        ok: true,
        data: { action: 'created', leaseId: 'L-1' },
      })
    jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockResolvedValue({ ok: true, data: null })

    await syncLeases({ stateFile, queueFile })

    expect(syncLease.mock.calls.map((call) => call[2])).toEqual([
      'create',
      'terminate',
    ])
  })

  it('a void already held behind a queued terminate replaces it and is synced', async () => {
    const terminate = factory.leaseChange.build({
      leaseId: 'L-1',
      action: 'terminate',
      timestamp: new Date('2026-05-01T09:00:00.000Z'),
    })
    const voidChange = factory.leaseChange.build({
      leaseId: 'L-1',
      action: 'void',
      timestamp: new Date('2026-05-01T10:00:00.000Z'),
    })
    const terminateEntry = makeLeaseEntry(terminate)
    await appendEntry(queueFile, terminateEntry)
    await appendEntry(queueFile, {
      ...makeLeaseEntry(voidChange),
      heldBehind: terminateEntry.key,
    })
    jest
      .spyOn(leasingAdapter, 'getUpdatedLeases')
      .mockResolvedValue({ ok: true, data: [] })
    jest
      .spyOn(propertyManagementAdapter, 'getRentalPropertyInfoFromXpand')
      .mockResolvedValue({
        status: 200,
        data: factory.rentalPropertyInfo.build({ type: 'Lägenhet' }),
      })
    const syncLease = jest
      .spyOn(leasingAdapter, 'syncLease')
      .mockResolvedValue({
        ok: true,
        data: { action: 'voided', leaseId: 'L-1' },
      })
    jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockResolvedValue({ ok: true, data: null })

    await syncLeases({ stateFile, queueFile })

    expect(syncLease.mock.calls.map((call) => call[2])).toEqual(['void'])
    expect(await readQueue(queueFile)).toEqual([])
  })
})
