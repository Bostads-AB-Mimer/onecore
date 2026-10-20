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

const NOW = new Date('2026-10-15T08:30:00.000Z')
const HOUR = 60 * 60 * 1000

const hoursBefore = (date: Date, hours: number) =>
  new Date(date.getTime() - hours * HOUR).toISOString()

const entryFor = (
  c: Change,
  overrides: Partial<FailedRowEntry> = {}
): FailedRowEntry => ({
  key: `thing:${c.id}`,
  type: 'rental-object-type',
  payload: { ...c, timestamp: c.timestamp.toISOString() },
  addedAt: '2026-10-15T00:00:00.000Z',
  lastError: 'boom',
  ...overrides,
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

const run = (overrides: Partial<CmlogSync<Change>> = {}, now = NOW) =>
  runCmlogSync(definition(overrides), {
    stateFile,
    queueFile,
    now: () => now,
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
  it("first run fetches everything and saves the last row's timestamp", async () => {
    const c = change()
    fetchChanges.mockResolvedValue({ ok: true, data: [c] })

    await run()

    expect(fetchChanges).toHaveBeenCalledWith(null)
    expect(sync).toHaveBeenCalledWith(c)
    expect(await readState()).toBe(c.timestamp.toISOString())
  })

  it('fetches since the saved timestamp, syncs and sends no mail', async () => {
    const since = new Date('2026-10-15T07:00:00.000Z')
    await fs.writeFile(stateFile, since.toISOString(), 'utf-8')
    const c = change()
    fetchChanges.mockResolvedValue({ ok: true, data: [c] })

    await run()

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
      addedAt: NOW.toISOString(),
      lastAttemptAt: NOW.toISOString(),
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

  describe('retry schedule', () => {
    const failedFor = (
      hours: number,
      overrides: Partial<FailedRowEntry> = {}
    ) => entryFor(change(), { addedAt: hoursBefore(NOW, hours), ...overrides })

    it('first day: retries every run and records the attempt and latest error', async () => {
      await addEntry(
        queueFile,
        failedFor(23, { lastAttemptAt: hoursBefore(NOW, 0.02) })
      )
      sync.mockRejectedValue(new Error('still down'))

      await run()

      expect(sync).toHaveBeenCalledTimes(1)
      const [entry] = await readQueue(queueFile)
      expect(entry.lastAttemptAt).toBe(NOW.toISOString())
      expect(entry.lastError).toBe('still down')
      expect(entry.addedAt).toBe(hoursBefore(NOW, 23))
      expect(sendEmailSpy).not.toHaveBeenCalled()
    })

    it('after a day: skips an entry tried less than six hours ago', async () => {
      await addEntry(
        queueFile,
        failedFor(30, { lastAttemptAt: hoursBefore(NOW, 5) })
      )

      await run()

      expect(sync).not.toHaveBeenCalled()
      expect(await readQueue(queueFile)).toHaveLength(1)
      expect(sendEmailSpy).not.toHaveBeenCalled()
    })

    it('after a day: retries six hours after the last attempt and mails once that it still fails', async () => {
      await addEntry(
        queueFile,
        failedFor(30, { lastAttemptAt: hoursBefore(NOW, 6) })
      )
      sync.mockRejectedValue(new Error('still down'))

      await run()

      expect(sync).toHaveBeenCalledTimes(1)
      const [entry] = await readQueue(queueFile)
      expect(entry.lastAttemptAt).toBe(NOW.toISOString())
      expect(entry.stillFailingNotifiedAt).toBe(NOW.toISOString())
      expect(subjects()).toEqual([
        'sync-things: sak A-1 misslyckas fortfarande',
      ])
      expect(sendEmailSpy.mock.calls[0][0].body).toContain('var sjätte timme')
    })

    it('after a day: does not repeat the still-failing mail', async () => {
      await addEntry(
        queueFile,
        failedFor(60, {
          lastAttemptAt: hoursBefore(NOW, 6),
          stillFailingNotifiedAt: hoursBefore(NOW, 30),
        })
      )
      sync.mockRejectedValue(new Error('still down'))

      await run()

      expect(sync).toHaveBeenCalledTimes(1)
      expect(sendEmailSpy).not.toHaveBeenCalled()
    })

    it('treats an entry without lastAttemptAt as last tried when it was added', async () => {
      await addEntry(queueFile, failedFor(30))
      sync.mockRejectedValue(new Error('still down'))

      await run()

      expect(sync).toHaveBeenCalledTimes(1)
    })

    it('after a day: recovery still removes the entry and mails', async () => {
      await addEntry(
        queueFile,
        failedFor(100, { lastAttemptAt: hoursBefore(NOW, 7) })
      )

      await run()

      expect(await readQueue(queueFile)).toEqual([])
      expect(subjects()).toEqual([
        'sync-things: tidigare felande sak A-1 är nu synkat',
      ])
    })

    it('after a week: gives up on the next failed attempt, removes the entry and mails', async () => {
      await addEntry(
        queueFile,
        failedFor(7 * 24 + 1, {
          lastAttemptAt: hoursBefore(NOW, 6),
          stillFailingNotifiedAt: hoursBefore(NOW, 6 * 24),
        })
      )
      sync.mockRejectedValue(new Error('still down'))

      await run()

      expect(sync).toHaveBeenCalledTimes(1)
      expect(await readQueue(queueFile)).toEqual([])
      expect(subjects()).toEqual(['sync-things: ger upp sak A-1'])
      expect(sendEmailSpy.mock.calls[0][0].body).toContain('still down')
    })

    it('a newer change for the same key starts a fresh clock', async () => {
      await addEntry(
        queueFile,
        failedFor(7 * 24 + 1, { lastAttemptAt: hoursBefore(NOW, 1) })
      )
      const newer = change({
        value: 'new',
        timestamp: new Date('2026-10-15T08:10:00.000Z'),
      })
      fetchChanges.mockResolvedValue({ ok: true, data: [newer] })
      sync.mockRejectedValue(new Error('down'))

      await run()

      const [entry] = await readQueue(queueFile)
      expect(entry.addedAt).toBe(NOW.toISOString())
      expect(subjects()).toEqual(['sync-things: nytt fel på sak A-1'])
    })
  })

  it('throws when fetching fails and leaves the timestamp alone', async () => {
    await fs.writeFile(stateFile, '2026-10-15T07:00:00.000Z', 'utf-8')
    fetchChanges.mockResolvedValue({ ok: false, err: 'unknown' })

    await expect(run()).rejects.toThrow('unknown')
    expect(await readState()).toBe('2026-10-15T07:00:00.000Z')
  })
})
