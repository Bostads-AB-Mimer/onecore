import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import config from '../../common/config'
import { syncContacts } from './index'
import * as factory from '../../../test/factories'
import { addEntry, readQueue, FailedRowEntry } from '../shared/failed-sync-queue'
import * as contactsAdapterModule from '../../adapters/contacts-adapter'
import * as leasingAdapter from '../../adapters/leasing-adapter'
import * as economyAdapter from '../../adapters/economy-adapter'
import * as workOrderAdapter from '../../adapters/work-order-adapter'
import * as communicationAdapter from '../../adapters/communication-adapter'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Queue entry for a contact — uses the domain contact shape (ContactIndividual) */
const makeContactEntry = (
  contact: ReturnType<typeof factory.domainContact.build>,
  timestamp: Date,
  error = 'xpand-error'
): FailedRowEntry => ({
  key: `${contact.contactCode}:${timestamp.toISOString()}`,
  type: 'contact',
  payload: { contact, timestamp: timestamp.toISOString() },
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
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-'))
  stateFile = path.join(dir, 'last-timestamp.txt')
  queueFile = path.join(dir, 'failed-rows.jsonl')
  // Enable email notifications
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

describe('syncContacts', () => {
  it('case 1: happy path — queue empty, contacts sync, state file advances', async () => {
    const contact = factory.domainContact.build()
    const ts = new Date('2026-05-01T10:00:00.000Z')

    jest
      .spyOn(contactsAdapterModule, 'makeContactsAdapter')
      .mockReturnValue({
        getUpdatedContacts: jest.fn().mockResolvedValue({
          ok: true,
          data: [{ contact, timestamp: ts }],
        }),
      } as any)

    jest
      .spyOn(leasingAdapter, 'syncContactToLeasing')
      .mockResolvedValue({ ok: true })

    jest
      .spyOn(economyAdapter, 'syncContactToEconomy')
      .mockResolvedValue({ ok: true })

    jest
      .spyOn(workOrderAdapter, 'syncContactToWorkOrder')
      .mockResolvedValue({ ok: true, data: { skipped: false } })

    const sendEmailSpy = jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockResolvedValue({ ok: true, data: null })

    await syncContacts({ stateFile, queueFile })

    // No queue entries
    expect(await readQueue(queueFile)).toHaveLength(0)

    // State file advanced
    const written = (await fs.readFile(stateFile, 'utf-8')).trim()
    expect(written).toBe(ts.toISOString())

    // No emails sent
    expect(sendEmailSpy).not.toHaveBeenCalled()

    // Work-order adapter was called
    expect(workOrderAdapter.syncContactToWorkOrder).toHaveBeenCalledTimes(1)
  })

  it('case 2: first failure — row queued + one failure mail sent', async () => {
    const contact = factory.domainContact.build()
    const ts = new Date('2026-05-01T11:00:00.000Z')

    jest
      .spyOn(contactsAdapterModule, 'makeContactsAdapter')
      .mockReturnValue({
        getUpdatedContacts: jest.fn().mockResolvedValue({
          ok: true,
          data: [{ contact, timestamp: ts }],
        }),
      } as any)

    // Leasing sync fails → whole contact sync fails
    jest
      .spyOn(leasingAdapter, 'syncContactToLeasing')
      .mockResolvedValue({ ok: false, err: 'xpand-error' })

    jest
      .spyOn(economyAdapter, 'syncContactToEconomy')
      .mockResolvedValue({ ok: true })

    jest
      .spyOn(workOrderAdapter, 'syncContactToWorkOrder')
      .mockResolvedValue({ ok: true, data: { skipped: false } })

    const sendEmailSpy = jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockResolvedValue({ ok: true, data: null })

    await syncContacts({ stateFile, queueFile })

    // Queue has one entry with the expected key
    const queue = await readQueue(queueFile)
    expect(queue).toHaveLength(1)
    expect(queue[0].key).toBe(`${contact.contactCode}:${ts.toISOString()}`)
    expect(queue[0].type).toBe('contact')

    // Failure email was sent
    expect(sendEmailSpy).toHaveBeenCalledTimes(1)
    expect(sendEmailSpy.mock.calls[0][0].subject).toMatch(
      `sync-contacts: nytt fel på kontakt ${contact.contactCode}`
    )

    // State advanced
    const written = (await fs.readFile(stateFile, 'utf-8')).trim()
    expect(written).toBe(ts.toISOString())
  })

  it('case 3: silent retry — queue has entry, drain fails, no mails sent', async () => {
    const contact = factory.domainContact.build()
    const ts = new Date('2026-05-01T09:00:00.000Z')

    // Pre-seed the queue
    const entry = makeContactEntry(contact, ts)
    await addEntry(queueFile, entry)

    // Drain attempt: leasing sync fails
    jest
      .spyOn(leasingAdapter, 'syncContactToLeasing')
      .mockResolvedValue({ ok: false, err: 'xpand-error' })

    jest
      .spyOn(economyAdapter, 'syncContactToEconomy')
      .mockResolvedValue({ ok: true })

    jest
      .spyOn(workOrderAdapter, 'syncContactToWorkOrder')
      .mockResolvedValue({ ok: true, data: { skipped: false } })

    // No new rows
    jest
      .spyOn(contactsAdapterModule, 'makeContactsAdapter')
      .mockReturnValue({
        getUpdatedContacts: jest.fn().mockResolvedValue({
          ok: true,
          data: [],
        }),
      } as any)

    const sendEmailSpy = jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockResolvedValue({ ok: true, data: null })

    await syncContacts({ stateFile, queueFile })

    // Queue unchanged
    const queue = await readQueue(queueFile)
    expect(queue).toHaveLength(1)
    expect(queue[0].key).toBe(entry.key)

    // Email was NOT sent (silent retry)
    expect(sendEmailSpy).not.toHaveBeenCalled()

    // State file not written (no new rows)
    await expect(fs.readFile(stateFile, 'utf-8')).rejects.toThrow()
  })

  it('case 4: recovery — queue has entry, drain succeeds, recovery mail sent, state unchanged', async () => {
    const contact = factory.domainContact.build()
    const ts = new Date('2026-05-01T08:00:00.000Z')

    // Pre-seed the queue
    const entry = makeContactEntry(contact, ts)
    await addEntry(queueFile, entry)

    // Drain attempt: all sync adapters succeed
    jest
      .spyOn(leasingAdapter, 'syncContactToLeasing')
      .mockResolvedValue({ ok: true })

    jest
      .spyOn(economyAdapter, 'syncContactToEconomy')
      .mockResolvedValue({ ok: true })

    jest
      .spyOn(workOrderAdapter, 'syncContactToWorkOrder')
      .mockResolvedValue({ ok: true, data: { skipped: false } })

    // No new rows
    jest
      .spyOn(contactsAdapterModule, 'makeContactsAdapter')
      .mockReturnValue({
        getUpdatedContacts: jest.fn().mockResolvedValue({
          ok: true,
          data: [],
        }),
      } as any)

    const sendEmailSpy = jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockResolvedValue({ ok: true, data: null })

    await syncContacts({ stateFile, queueFile })

    // Queue is now empty
    expect(await readQueue(queueFile)).toHaveLength(0)

    // Recovery email was sent
    expect(sendEmailSpy).toHaveBeenCalledTimes(1)
    expect(sendEmailSpy.mock.calls[0][0].subject).toMatch(
      `sync-contacts: tidigare felande kontakt ${contact.contactCode} är nu synkat`
    )

    // State file not written (no new rows)
    await expect(fs.readFile(stateFile, 'utf-8')).rejects.toThrow()
  })

  it('case 5: crash-retry dedupe — pre-queued entry matches incoming row, single queue entry, no duplicate mail', async () => {
    const contact = factory.domainContact.build()
    const ts = new Date('2026-05-01T07:00:00.000Z')

    // Pre-seed the queue with that key
    const entry = makeContactEntry(contact, ts)
    await addEntry(queueFile, entry)

    // Both drain attempt and new row attempt fail (leasing fails)
    jest
      .spyOn(leasingAdapter, 'syncContactToLeasing')
      .mockResolvedValue({ ok: false, err: 'xpand-error' })

    jest
      .spyOn(economyAdapter, 'syncContactToEconomy')
      .mockResolvedValue({ ok: true })

    jest
      .spyOn(workOrderAdapter, 'syncContactToWorkOrder')
      .mockResolvedValue({ ok: true, data: { skipped: false } })

    // New cmlog row: same contact, same timestamp
    jest
      .spyOn(contactsAdapterModule, 'makeContactsAdapter')
      .mockReturnValue({
        getUpdatedContacts: jest.fn().mockResolvedValue({
          ok: true,
          data: [{ contact, timestamp: ts }],
        }),
      } as any)

    const sendEmailSpy = jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockResolvedValue({ ok: true, data: null })

    await syncContacts({ stateFile, queueFile })

    // Queue still has exactly one entry (no duplicate)
    const queue = await readQueue(queueFile)
    expect(queue).toHaveLength(1)
    expect(queue[0].key).toBe(entry.key)

    // No failure mail sent (dedupe gate)
    expect(sendEmailSpy).not.toHaveBeenCalled()

    // State advanced to the row's timestamp
    const written = (await fs.readFile(stateFile, 'utf-8')).trim()
    expect(written).toBe(ts.toISOString())
  })
})
