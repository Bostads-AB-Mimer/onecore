import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import nock from 'nock'
import config from '../../common/config'
import { syncContacts } from './index'
import * as factory from '../../../test/factories'
import { addEntry, readQueue, FailedRowEntry } from '../shared/failed-sync-queue'
import * as workOrderAdapter from '../../adapters/work-order-adapter'

// ---------------------------------------------------------------------------
// Note on work-order adapter:
// syncContactToWorkOrder uses openapi-fetch (native fetch), not axios.
// nock only intercepts node http / axios. We therefore spy on the work-order
// adapter function directly. All other adapters (contacts, leasing, economy,
// communication) are axios-based and are intercepted by nock.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a domain Contact matching the sync-contacts/payload.ts shape */
const buildDomainContact = (contactCode?: string) =>
  factory.domainContact.build(contactCode ? { contactCode } : undefined)

/** Wire-format for the getUpdatedContacts endpoint */
const updatedContactsBody = (
  contacts: Array<{
    contact: ReturnType<typeof buildDomainContact>
    timestamp: string
  }>
) => ({
  _links: {},
  content: { contacts },
})

/** Queue entry for a contact */
const makeContactEntry = (
  contact: ReturnType<typeof buildDomainContact>,
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
// Nock helpers
// ---------------------------------------------------------------------------

const nockGetUpdatedContacts = (
  contacts: Array<{
    contact: ReturnType<typeof buildDomainContact>
    timestamp: string
  }>
) =>
  nock(config.contactsService.url)
    .get('/contacts/sync')
    .query(true)
    .reply(200, updatedContactsBody(contacts))

const nockSyncToLeasing = (contactCode: string, status = 200) =>
  nock(config.tenantsLeasesService.url)
    .post(`/contacts/${contactCode}/sync`)
    .reply(status, { content: null })

const nockSyncToEconomy = (contactCode: string, status = 200) =>
  nock(config.economyService.url)
    .post(`/contacts/${contactCode}/sync`)
    .reply(status, { content: null })

const nockSendEmail = () =>
  nock(config.communicationService.url)
    .post('/send-email')
    .reply(200, { content: null })

// ---------------------------------------------------------------------------
// Test state
// ---------------------------------------------------------------------------

let dir: string
let stateFile: string
let queueFile: string
let workOrderSpy: jest.SpyInstance

const originalXpandSync = config.emailAddresses.xpandSync

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-'))
  stateFile = path.join(dir, 'last-timestamp.txt')
  queueFile = path.join(dir, 'failed-rows.jsonl')
  // Enable email notifications
  ;(config.emailAddresses as Record<string, string>).xpandSync =
    'sync@example.com'
  // Default spy: work-order sync succeeds
  workOrderSpy = jest
    .spyOn(workOrderAdapter, 'syncContactToWorkOrder')
    .mockResolvedValue({ ok: true, data: { skipped: false } })
})

afterEach(async () => {
  ;(config.emailAddresses as Record<string, string>).xpandSync =
    originalXpandSync
  nock.cleanAll()
  jest.restoreAllMocks()
  await fs.rm(dir, { recursive: true, force: true })
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('syncContacts', () => {
  it('case 1: happy path — queue empty, contacts sync, state file advances', async () => {
    const contact = buildDomainContact()
    const ts = new Date('2026-05-01T10:00:00.000Z')

    nockGetUpdatedContacts([{ contact, timestamp: ts.toISOString() }])
    nockSyncToLeasing(contact.contactCode)
    nockSyncToEconomy(contact.contactCode)
    // workOrderSpy already set to succeed

    await syncContacts({ stateFile, queueFile })

    // No queue entries
    expect(await readQueue(queueFile)).toHaveLength(0)

    // State file advanced
    const written = (await fs.readFile(stateFile, 'utf-8')).trim()
    expect(written).toBe(ts.toISOString())

    // No emails sent — expect nock queue to not have a pending /send-email
    expect(nock.pendingMocks().filter((m) => m.includes('send-email'))).toHaveLength(0)

    // Work-order adapter was called
    expect(workOrderSpy).toHaveBeenCalledTimes(1)
  })

  it('case 2: first failure — row queued + one failure mail sent', async () => {
    const contact = buildDomainContact()
    const ts = new Date('2026-05-01T11:00:00.000Z')

    nockGetUpdatedContacts([{ contact, timestamp: ts.toISOString() }])
    // Leasing sync fails → whole contact sync fails
    nockSyncToLeasing(contact.contactCode, 500)
    nockSyncToEconomy(contact.contactCode)
    // workOrderSpy succeeds but leasing failure causes the throw
    const emailScope = nockSendEmail()

    await syncContacts({ stateFile, queueFile })

    // Queue has one entry with the expected key
    const queue = await readQueue(queueFile)
    expect(queue).toHaveLength(1)
    expect(queue[0].key).toBe(`${contact.contactCode}:${ts.toISOString()}`)
    expect(queue[0].type).toBe('contact')

    // Failure email was sent
    expect(emailScope.isDone()).toBe(true)

    // State advanced
    const written = (await fs.readFile(stateFile, 'utf-8')).trim()
    expect(written).toBe(ts.toISOString())
  })

  it('case 3: silent retry — queue has entry, drain fails, no mails sent', async () => {
    const contact = buildDomainContact()
    const ts = new Date('2026-05-01T09:00:00.000Z')

    // Pre-seed the queue
    const entry = makeContactEntry(contact, ts)
    await addEntry(queueFile, entry)

    // Drain attempt: leasing sync fails
    nockSyncToLeasing(contact.contactCode, 500)
    nockSyncToEconomy(contact.contactCode)

    // No new rows
    nockGetUpdatedContacts([])

    // Set up email interceptor but expect it NOT to be consumed
    const emailScope = nockSendEmail()

    await syncContacts({ stateFile, queueFile })

    // Queue unchanged
    const queue = await readQueue(queueFile)
    expect(queue).toHaveLength(1)
    expect(queue[0].key).toBe(entry.key)

    // Email was NOT sent
    expect(emailScope.isDone()).toBe(false)
    nock.cleanAll()

    // State file not written (no new rows)
    await expect(fs.readFile(stateFile, 'utf-8')).rejects.toThrow()
  })

  it('case 4: recovery — queue has entry, drain succeeds, recovery mail sent, state unchanged', async () => {
    const contact = buildDomainContact()
    const ts = new Date('2026-05-01T08:00:00.000Z')

    // Pre-seed the queue
    const entry = makeContactEntry(contact, ts)
    await addEntry(queueFile, entry)

    // Drain attempt: all sync adapters succeed
    nockSyncToLeasing(contact.contactCode)
    nockSyncToEconomy(contact.contactCode)
    // workOrderSpy already set to succeed

    // No new rows
    nockGetUpdatedContacts([])

    // Expect one recovery email
    const emailScope = nockSendEmail()

    await syncContacts({ stateFile, queueFile })

    // Queue is now empty
    expect(await readQueue(queueFile)).toHaveLength(0)

    // Recovery email was sent
    expect(emailScope.isDone()).toBe(true)

    // State file not written (no new rows)
    await expect(fs.readFile(stateFile, 'utf-8')).rejects.toThrow()
  })

  it('case 5: crash-retry dedupe — pre-queued entry matches incoming row, single queue entry, no duplicate mail', async () => {
    const contact = buildDomainContact()
    const ts = new Date('2026-05-01T07:00:00.000Z')

    // Pre-seed the queue with that key
    const entry = makeContactEntry(contact, ts)
    await addEntry(queueFile, entry)

    // Drain attempt fails (leasing 500)
    nockSyncToLeasing(contact.contactCode, 500)
    nockSyncToEconomy(contact.contactCode)

    // New cmlog row: same contact, same timestamp
    nockGetUpdatedContacts([{ contact, timestamp: ts.toISOString() }])

    // New row's sync also fails (second call to leasing)
    nockSyncToLeasing(contact.contactCode, 500)
    nockSyncToEconomy(contact.contactCode)

    // Track whether email was sent
    const emailScope = nockSendEmail()

    await syncContacts({ stateFile, queueFile })

    // Queue still has exactly one entry (no duplicate)
    const queue = await readQueue(queueFile)
    expect(queue).toHaveLength(1)
    expect(queue[0].key).toBe(entry.key)

    // No failure mail sent (dedupe gate)
    expect(emailScope.isDone()).toBe(false)
    nock.cleanAll()

    // State advanced to the row's timestamp
    const written = (await fs.readFile(stateFile, 'utf-8')).trim()
    expect(written).toBe(ts.toISOString())
  })
})
