import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import config from '../../common/config'
import * as communicationAdapter from '../../adapters/communication-adapter'
import { addEntry, readQueue, FailedRowEntry } from './failed-sync-queue'
import { CmlogSync, PermanentSyncError, runCmlogSync } from './run-cmlog-sync'

type Change = { id: string; value: string; timestamp: Date }

const change = (overrides: Partial<Change> = {}): Change => ({
  id: 'A-1',
  value: 'x',
  timestamp: new Date('2026-10-15T08:00:00.000Z'),
  ...overrides,
})

const entryFor = (c: Change, lastError = 'boom'): FailedRowEntry => ({
  key: `thing:${c.id}`,
  type: 'rental-object-type',
  payload: { ...c, timestamp: c.timestamp.toISOString() },
  addedAt: '2026-10-15T00:00:00.000Z',
  lastError,
})

let dir: string
let stateFile: string
let queueFile: string
let sendEmailSpy: jest.SpyInstance
let fetchChanges: jest.Mock
let sync: jest.Mock

const originalXpandSync = config.emailAddresses.xpandSync

const definition = (
  overrides: Partial<CmlogSync<Change>> = {}
): CmlogSync<Change> => ({
  name: 'sync-things',
  entryType: 'rental-object-type',
  firstRun: 'all',
  fetchChanges,
  sync,
  keyFor: (c) => `thing:${c.id}`,
  timestampOf: (c) => c.timestamp,
  toPayload: (c) => ({ ...c, timestamp: c.timestamp.toISOString() }),
  fromPayload: (p) => {
    const raw = p as Omit<Change, 'timestamp'> & { timestamp: string }
    return { ...raw, timestamp: new Date(raw.timestamp) }
  },
  describe: (c) => ({ subject: `sak ${c.id}`, detail: `sak ${c.id}` }),
  ...overrides,
})

const run = (overrides: Partial<CmlogSync<Change>> = {}, now?: Date) =>
  runCmlogSync(definition(overrides), {
    stateFile,
    queueFile,
    now: now ? () => now : undefined,
  })

const readState = async () => (await fs.readFile(stateFile, 'utf-8')).trim()

const subjects = () =>
  sendEmailSpy.mock.calls.map(([email]) => email.subject as string)

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cmlog-sync-'))
  stateFile = path.join(dir, 'last-timestamp.txt')
  queueFile = path.join(dir, 'failed-rows.jsonl')
  fetchChanges = jest.fn().mockResolvedValue({ ok: true, data: [] })
  sync = jest.fn().mockResolvedValue(undefined)
  ;(config.emailAddresses as Record<string, string>).xpandSync =
    'sync@example.com'
  sendEmailSpy = jest
    .spyOn(communicationAdapter, 'sendEmail')
    .mockResolvedValue({ ok: true, data: null })
})

afterEach(async () => {
  ;(config.emailAddresses as Record<string, string>).xpandSync =
    originalXpandSync
  jest.restoreAllMocks()
  await fs.rm(dir, { recursive: true, force: true })
})

describe('runCmlogSync', () => {
  describe('first run', () => {
    it("'all' fetches everything and saves the last row's timestamp", async () => {
      const c = change()
      fetchChanges.mockResolvedValue({ ok: true, data: [c] })

      await run()

      expect(fetchChanges).toHaveBeenCalledWith(null)
      expect(sync).toHaveBeenCalledWith(c)
      expect(await readState()).toBe(c.timestamp.toISOString())
    })

    it("'now' saves Swedish summer wall-clock time and syncs nothing", async () => {
      await run({ firstRun: 'now' }, new Date('2026-10-15T08:00:00.000Z'))

      expect(await readState()).toBe('2026-10-15T10:00:00.000Z')
      expect(fetchChanges).not.toHaveBeenCalled()
      expect(sync).not.toHaveBeenCalled()
    })

    it("'now' saves Swedish winter wall-clock time", async () => {
      await run({ firstRun: 'now' }, new Date('2026-12-01T08:00:00.000Z'))

      expect(await readState()).toBe('2026-12-01T09:00:00.000Z')
    })
  })

  it('fetches since the saved timestamp, syncs and sends no mail', async () => {
    const since = new Date('2026-10-15T07:00:00.000Z')
    await fs.writeFile(stateFile, since.toISOString(), 'utf-8')
    const c = change()
    fetchChanges.mockResolvedValue({ ok: true, data: [c] })

    await run({ firstRun: 'now' })

    expect(fetchChanges).toHaveBeenCalledWith(since)
    expect(sync).toHaveBeenCalledWith(c)
    expect(sendEmailSpy).not.toHaveBeenCalled()
    expect(await readQueue(queueFile)).toEqual([])
    expect(await readState()).toBe(c.timestamp.toISOString())
  })

  it('first failure: queues the row and sends one failure mail', async () => {
    const c = change()
    fetchChanges.mockResolvedValue({ ok: true, data: [c] })
    sync.mockRejectedValue(new Error('tenfast down'))

    await run()

    const queue = await readQueue(queueFile)
    expect(queue).toHaveLength(1)
    expect(queue[0]).toMatchObject({
      key: 'thing:A-1',
      type: 'rental-object-type',
      lastError: 'tenfast down',
    })
    expect(subjects()).toEqual(['sync-things: nytt fel på sak A-1'])
    expect(await readState()).toBe(c.timestamp.toISOString())
  })

  it('silent retry: queued row still failing keeps the entry and sends no mail', async () => {
    await addEntry(queueFile, entryFor(change()))
    sync.mockRejectedValue(new Error('still down'))

    await run()

    expect(await readQueue(queueFile)).toHaveLength(1)
    expect(sendEmailSpy).not.toHaveBeenCalled()
    await expect(fs.readFile(stateFile, 'utf-8')).rejects.toThrow()
  })

  it('recovery: queued row syncing removes the entry and sends a recovery mail', async () => {
    await addEntry(queueFile, entryFor(change()))

    await run()

    expect(await readQueue(queueFile)).toEqual([])
    expect(subjects()).toEqual([
      'sync-things: tidigare felande sak A-1 är nu synkat',
    ])
  })

  it('crash retry: the same row failing again keeps one entry and sends no mail', async () => {
    const c = change()
    await addEntry(queueFile, entryFor(c))
    fetchChanges.mockResolvedValue({ ok: true, data: [c] })
    sync.mockRejectedValue(new Error('still down'))

    await run()

    expect(await readQueue(queueFile)).toHaveLength(1)
    expect(sendEmailSpy).not.toHaveBeenCalled()
  })

  it('a newer failing row replaces the queued entry with the same key and mails', async () => {
    const older = change({ value: 'old' })
    const newer = change({
      value: 'new',
      timestamp: new Date('2026-10-15T08:10:00.000Z'),
    })
    await addEntry(queueFile, entryFor(older))
    fetchChanges.mockResolvedValue({ ok: true, data: [newer] })
    sync.mockRejectedValue(new Error('down'))

    await run()

    const queue = await readQueue(queueFile)
    expect(queue).toHaveLength(1)
    expect((queue[0].payload as Change).value).toBe('new')
    expect(subjects()).toEqual(['sync-things: nytt fel på sak A-1'])
  })

  it('a newer row syncing removes a still-failing queued entry with the same key', async () => {
    const older = change({ value: 'old' })
    const newer = change({
      value: 'new',
      timestamp: new Date('2026-10-15T08:10:00.000Z'),
    })
    await addEntry(queueFile, entryFor(older))
    fetchChanges.mockResolvedValue({ ok: true, data: [newer] })
    sync.mockImplementation(async (c: Change) => {
      if (c.value === 'old') throw new Error('down')
    })

    await run()

    expect(sync.mock.calls.map(([c]) => c.value)).toEqual(['old', 'new'])
    expect(await readQueue(queueFile)).toEqual([])
    expect(subjects()).toEqual([
      'sync-things: tidigare felande sak A-1 är nu synkat',
    ])
  })

  describe('permanent errors', () => {
    it('a new row is mailed once and not queued', async () => {
      const c = change()
      fetchChanges.mockResolvedValue({ ok: true, data: [c] })
      sync.mockRejectedValue(new PermanentSyncError('no such type'))

      await run()

      expect(await readQueue(queueFile)).toEqual([])
      expect(subjects()).toEqual(['sync-things: sak A-1 kan inte synkas'])
      expect(sendEmailSpy.mock.calls[0][0].body).toContain('no such type')
      expect(await readState()).toBe(c.timestamp.toISOString())
    })

    it('a queued row is removed and mailed once', async () => {
      await addEntry(queueFile, entryFor(change()))
      sync.mockRejectedValue(new PermanentSyncError('no such type'))

      await run()

      expect(await readQueue(queueFile)).toEqual([])
      expect(subjects()).toEqual(['sync-things: sak A-1 kan inte synkas'])
    })
  })

  it('leaves queue entries of other types alone', async () => {
    const other: FailedRowEntry = {
      key: 'L-1:create:2026-10-15T00:00:00.000Z',
      type: 'lease',
      payload: { leaseId: 'L-1' },
      addedAt: '2026-10-15T00:00:00.000Z',
      lastError: 'x',
    }
    await addEntry(queueFile, other)

    await run()

    expect(sync).not.toHaveBeenCalled()
    expect(await readQueue(queueFile)).toEqual([other])
  })

  it('a failing mail does not stop the row from being queued and saved', async () => {
    const c = change()
    fetchChanges.mockResolvedValue({ ok: true, data: [c] })
    sync.mockRejectedValue(new Error('down'))
    sendEmailSpy.mockRejectedValue(new Error('smtp down'))

    await run()

    expect(await readQueue(queueFile)).toHaveLength(1)
    expect(await readState()).toBe(c.timestamp.toISOString())
  })

  it('throws when fetching fails and leaves the timestamp alone', async () => {
    await fs.writeFile(stateFile, '2026-10-15T07:00:00.000Z', 'utf-8')
    fetchChanges.mockResolvedValue({ ok: false, err: 'unknown' })

    await expect(run()).rejects.toThrow('unknown')
    expect(await readState()).toBe('2026-10-15T07:00:00.000Z')
  })
})
