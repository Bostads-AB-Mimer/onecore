import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import config from '../../common/config'
import { syncContacts } from './index'
import * as factory from '../../../test/factories'
import {
  addEntry,
  readQueue,
  FailedRowEntry,
} from '../shared/failed-sync-queue'
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

    jest.spyOn(contactsAdapterModule, 'makeContactsAdapter').mockReturnValue({
      getUpdatedContacts: jest.fn().mockResolvedValue({
        ok: true,
        data: [{ contact, timestamp: ts }],
      }),
    } as any)

    jest
      .spyOn(leasingAdapter, 'syncContactToLeasing')
      .mockResolvedValue({ ok: true, data: { skipped: false } })

    jest
      .spyOn(economyAdapter, 'syncContactToEconomy')
      .mockResolvedValue({ ok: true, data: { skipped: false } })

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

    jest.spyOn(contactsAdapterModule, 'makeContactsAdapter').mockReturnValue({
      getUpdatedContacts: jest.fn().mockResolvedValue({
        ok: true,
        data: [{ contact, timestamp: ts }],
      }),
    } as any)

    // Leasing sync fails → whole contact sync fails
    jest
      .spyOn(leasingAdapter, 'syncContactToLeasing')
      .mockResolvedValue({ ok: false, err: 'sync-failed' })

    jest
      .spyOn(economyAdapter, 'syncContactToEconomy')
      .mockResolvedValue({ ok: true, data: { skipped: false } })

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
      .mockResolvedValue({ ok: false, err: 'sync-failed' })

    jest
      .spyOn(economyAdapter, 'syncContactToEconomy')
      .mockResolvedValue({ ok: true, data: { skipped: false } })

    jest
      .spyOn(workOrderAdapter, 'syncContactToWorkOrder')
      .mockResolvedValue({ ok: true, data: { skipped: false } })

    // No new rows
    jest.spyOn(contactsAdapterModule, 'makeContactsAdapter').mockReturnValue({
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
      .mockResolvedValue({ ok: true, data: { skipped: false } })

    jest
      .spyOn(economyAdapter, 'syncContactToEconomy')
      .mockResolvedValue({ ok: true, data: { skipped: false } })

    jest
      .spyOn(workOrderAdapter, 'syncContactToWorkOrder')
      .mockResolvedValue({ ok: true, data: { skipped: false } })

    // No new rows
    jest.spyOn(contactsAdapterModule, 'makeContactsAdapter').mockReturnValue({
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
      .mockResolvedValue({ ok: false, err: 'sync-failed' })

    jest
      .spyOn(economyAdapter, 'syncContactToEconomy')
      .mockResolvedValue({ ok: true, data: { skipped: false } })

    jest
      .spyOn(workOrderAdapter, 'syncContactToWorkOrder')
      .mockResolvedValue({ ok: true, data: { skipped: false } })

    // New cmlog row: same contact, same timestamp
    jest.spyOn(contactsAdapterModule, 'makeContactsAdapter').mockReturnValue({
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

  it('case 6: related contacts (all triggering roles) — additional leasing calls with correct payloads', async () => {
    const relatedTrusteeFor = {
      contactCode: 'P200001',
      role: 'trusteeFor' as const,
      fullName: 'Anna Andersson',
      firstName: 'Anna',
      lastName: 'Andersson',
    }
    const relatedAdministratorFor = {
      contactCode: 'P200002',
      role: 'administratorFor' as const,
      fullName: 'Bo Bengtsson',
      firstName: 'Bo',
      lastName: 'Bengtsson',
    }
    const relatedInvoiceRecipientFor = {
      contactCode: 'P200003',
      role: 'otherInvoiceRecipientFor' as const,
      fullName: 'Carin Carlsson',
      firstName: 'Carin',
      lastName: 'Carlsson',
    }
    const contact = factory.domainContact.build({
      relatedContacts: [
        relatedTrusteeFor,
        relatedAdministratorFor,
        relatedInvoiceRecipientFor,
      ],
    })
    const ts = new Date('2026-05-02T10:00:00.000Z')

    jest.spyOn(contactsAdapterModule, 'makeContactsAdapter').mockReturnValue({
      getUpdatedContacts: jest.fn().mockResolvedValue({
        ok: true,
        data: [{ contact, timestamp: ts }],
      }),
    } as any)

    const syncLeasingSpy = jest
      .spyOn(leasingAdapter, 'syncContactToLeasing')
      .mockResolvedValue({ ok: true, data: { skipped: false } })

    jest
      .spyOn(economyAdapter, 'syncContactToEconomy')
      .mockResolvedValue({ ok: true, data: { skipped: false } })

    jest
      .spyOn(workOrderAdapter, 'syncContactToWorkOrder')
      .mockResolvedValue({ ok: true, data: { skipped: false } })

    jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockResolvedValue({ ok: true, data: null })

    await syncContacts({ stateFile, queueFile })

    // 1 call for main contact + 3 calls for related contacts
    expect(syncLeasingSpy).toHaveBeenCalledTimes(4)

    // trusteeFor: related contact called with trustee field
    expect(syncLeasingSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        contactCode: relatedTrusteeFor.contactCode,
        firstName: relatedTrusteeFor.firstName,
        lastName: relatedTrusteeFor.lastName,
        trustee: expect.objectContaining({ name: expect.any(String) }),
      })
    )

    // administratorFor: related contact called with administrator field
    expect(syncLeasingSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        contactCode: relatedAdministratorFor.contactCode,
        firstName: relatedAdministratorFor.firstName,
        lastName: relatedAdministratorFor.lastName,
        administrator: expect.objectContaining({ name: expect.any(String) }),
      })
    )

    // otherInvoiceRecipientFor: related contact called with invoiceRecipient field
    expect(syncLeasingSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        contactCode: relatedInvoiceRecipientFor.contactCode,
        firstName: relatedInvoiceRecipientFor.firstName,
        lastName: relatedInvoiceRecipientFor.lastName,
        invoiceRecipient: expect.objectContaining({ name: expect.any(String) }),
      })
    )

    expect(await readQueue(queueFile)).toHaveLength(0)
  })

  it('case 7: related contact leasing sync fails — main contact queued for retry', async () => {
    const relatedContact = {
      contactCode: 'P200004',
      role: 'trusteeFor' as const,
      fullName: 'Diana Davidsson',
      firstName: 'Diana',
      lastName: 'Davidsson',
    }
    const contact = factory.domainContact.build({
      relatedContacts: [relatedContact],
    })
    const ts = new Date('2026-05-02T11:00:00.000Z')

    jest.spyOn(contactsAdapterModule, 'makeContactsAdapter').mockReturnValue({
      getUpdatedContacts: jest.fn().mockResolvedValue({
        ok: true,
        data: [{ contact, timestamp: ts }],
      }),
    } as any)

    jest
      .spyOn(leasingAdapter, 'syncContactToLeasing')
      .mockResolvedValueOnce({ ok: true, data: { skipped: false } }) // main contact ok
      .mockResolvedValueOnce({ ok: false, err: 'sync-failed' }) // related contact fails

    jest
      .spyOn(economyAdapter, 'syncContactToEconomy')
      .mockResolvedValue({ ok: true, data: { skipped: false } })

    jest
      .spyOn(workOrderAdapter, 'syncContactToWorkOrder')
      .mockResolvedValue({ ok: true, data: { skipped: false } })

    const sendEmailSpy = jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockResolvedValue({ ok: true, data: null })

    await syncContacts({ stateFile, queueFile })

    // Main contact queued (not the related contact)
    const queue = await readQueue(queueFile)
    expect(queue).toHaveLength(1)
    expect(queue[0].key).toBe(`${contact.contactCode}:${ts.toISOString()}`)
    expect(queue[0].type).toBe('contact')

    // Failure email sent
    expect(sendEmailSpy).toHaveBeenCalledTimes(1)
    expect(sendEmailSpy.mock.calls[0][0].subject).toMatch(
      `sync-contacts: nytt fel på kontakt ${contact.contactCode}`
    )
  })

  it('case 8: non-triggering roles (trustee, administrator, otherInvoiceRecipient) — no additional leasing calls', async () => {
    const contact = factory.domainContact.build({
      relatedContacts: [
        {
          contactCode: 'P300001',
          role: 'trustee' as const,
          fullName: 'Erik Eriksson',
          firstName: 'Erik',
          lastName: 'Eriksson',
        },
        {
          contactCode: 'P300002',
          role: 'administrator' as const,
          fullName: 'Frida Friberg',
          firstName: 'Frida',
          lastName: 'Friberg',
        },
        {
          contactCode: 'P300003',
          role: 'otherInvoiceRecipient' as const,
          fullName: 'Gustav Gustafsson',
          firstName: 'Gustav',
          lastName: 'Gustafsson',
        },
      ],
    })
    const ts = new Date('2026-05-02T12:00:00.000Z')

    jest.spyOn(contactsAdapterModule, 'makeContactsAdapter').mockReturnValue({
      getUpdatedContacts: jest.fn().mockResolvedValue({
        ok: true,
        data: [{ contact, timestamp: ts }],
      }),
    } as any)

    const syncLeasingSpy = jest
      .spyOn(leasingAdapter, 'syncContactToLeasing')
      .mockResolvedValue({ ok: true, data: { skipped: false } })

    jest
      .spyOn(economyAdapter, 'syncContactToEconomy')
      .mockResolvedValue({ ok: true, data: { skipped: false } })

    jest
      .spyOn(workOrderAdapter, 'syncContactToWorkOrder')
      .mockResolvedValue({ ok: true, data: { skipped: false } })

    jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockResolvedValue({ ok: true, data: null })

    await syncContacts({ stateFile, queueFile })

    // Only 1 leasing call — main contact only, non-triggering roles not synced
    expect(syncLeasingSpy).toHaveBeenCalledTimes(1)
    expect(await readQueue(queueFile)).toHaveLength(0)
  })
})
