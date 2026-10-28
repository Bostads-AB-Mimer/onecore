import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import config from '../../common/config'
import * as communicationAdapter from '../../adapters/communication-adapter'
import { appendEntry, readQueue, FailedRowEntry } from './failed-sync-queue'
import { CmlogSync, runCmlogSync } from './run-cmlog-sync'

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
  firstRun: 'sync-all',
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
    await appendEntry(queueFile, entryFor(change()))
    sync.mockRejectedValue(new Error('still down'))

    await run()

    expect(await readQueue(queueFile)).toHaveLength(1)
    expect(sendEmailSpy).not.toHaveBeenCalled()
    await expect(fs.readFile(stateFile, 'utf-8')).rejects.toThrow()
  })

  it('recovery: queued row syncing removes the entry and sends a recovery mail', async () => {
    await appendEntry(queueFile, entryFor(change()))

    await run()

    expect(await readQueue(queueFile)).toEqual([])
    expect(subjects()).toEqual([
      'sync-things: tidigare felande sak A-1 är nu synkat',
    ])
  })

  it('crash retry: the same row failing again keeps one entry and sends no mail', async () => {
    const c = change()
    await appendEntry(queueFile, entryFor(c))
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
    await appendEntry(queueFile, entryFor(older))
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
    await appendEntry(queueFile, entryFor(older))
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

  it('leaves queue entries of other types alone', async () => {
    const other: FailedRowEntry = {
      key: 'L-1:create:2026-10-15T00:00:00.000Z',
      type: 'lease',
      payload: { leaseId: 'L-1' },
      addedAt: '2026-10-15T00:00:00.000Z',
      lastError: 'x',
    }
    await appendEntry(queueFile, other)

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
      await appendEntry(
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
      await appendEntry(
        queueFile,
        failedFor(30, { lastAttemptAt: hoursBefore(NOW, 5) })
      )

      await run()

      expect(sync).not.toHaveBeenCalled()
      expect(await readQueue(queueFile)).toHaveLength(1)
      expect(sendEmailSpy).not.toHaveBeenCalled()
    })

    it('after a day: retries six hours after the last attempt and mails once that it still fails', async () => {
      await appendEntry(
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
      await appendEntry(
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
      await appendEntry(queueFile, failedFor(30))
      sync.mockRejectedValue(new Error('still down'))

      await run()

      expect(sync).toHaveBeenCalledTimes(1)
    })

    it('an entry without lastAttemptAt starts its week at the first retry', async () => {
      await appendEntry(queueFile, failedFor(10 * 24))
      sync.mockRejectedValue(new Error('still down'))

      await run()

      const [entry] = await readQueue(queueFile)
      expect(entry.retriesStartedAt).toBe(NOW.toISOString())
      expect(entry.addedAt).toBe(hoursBefore(NOW, 10 * 24))
      expect(sendEmailSpy).not.toHaveBeenCalled()
    })

    it('gives up a month after retriesStartedAt, not addedAt', async () => {
      await appendEntry(
        queueFile,
        failedFor(40 * 24, {
          retriesStartedAt: hoursBefore(NOW, 29 * 24),
          lastAttemptAt: hoursBefore(NOW, 24),
          stillFailingNotifiedAt: hoursBefore(NOW, 28 * 24),
        })
      )
      sync.mockRejectedValue(new Error('still down'))

      await run()

      expect(await readQueue(queueFile)).toHaveLength(1)
      expect(sendEmailSpy).not.toHaveBeenCalled()
    })

    it('after a day: recovery still removes the entry and mails', async () => {
      await appendEntry(
        queueFile,
        failedFor(100, { lastAttemptAt: hoursBefore(NOW, 7) })
      )

      await run()

      expect(await readQueue(queueFile)).toEqual([])
      expect(subjects()).toEqual([
        'sync-things: tidigare felande sak A-1 är nu synkat',
      ])
    })

    it('after a week: skips an entry tried less than a day ago', async () => {
      await appendEntry(
        queueFile,
        failedFor(8 * 24, {
          lastAttemptAt: hoursBefore(NOW, 23),
          stillFailingNotifiedAt: hoursBefore(NOW, 7 * 24),
        })
      )

      await run()

      expect(sync).not.toHaveBeenCalled()
      expect(await readQueue(queueFile)).toHaveLength(1)
    })

    it('after a week: retries once a day and keeps the entry', async () => {
      await appendEntry(
        queueFile,
        failedFor(8 * 24, {
          lastAttemptAt: hoursBefore(NOW, 24),
          stillFailingNotifiedAt: hoursBefore(NOW, 7 * 24),
        })
      )
      sync.mockRejectedValue(new Error('still down'))

      await run()

      expect(sync).toHaveBeenCalledTimes(1)
      const [entry] = await readQueue(queueFile)
      expect(entry.lastAttemptAt).toBe(NOW.toISOString())
      expect(sendEmailSpy).not.toHaveBeenCalled()
    })

    it('the still-failing mail describes the daily retries and the give-up date', async () => {
      await appendEntry(
        queueFile,
        failedFor(30, { lastAttemptAt: hoursBefore(NOW, 6) })
      )
      sync.mockRejectedValue(new Error('still down'))

      await run()

      const body = sendEmailSpy.mock.calls[0][0].body as string
      expect(body).toContain('en gång om dygnet')
      expect(body).toContain(
        new Date(NOW.getTime() - 30 * HOUR + 30 * 24 * HOUR).toISOString()
      )
    })

    it('after a month: gives up on the next failed attempt, removes the entry and mails', async () => {
      await appendEntry(
        queueFile,
        failedFor(30 * 24 + 1, {
          lastAttemptAt: hoursBefore(NOW, 24),
          stillFailingNotifiedAt: hoursBefore(NOW, 29 * 24),
        })
      )
      sync.mockRejectedValue(new Error('still down'))

      await run()

      expect(sync).toHaveBeenCalledTimes(1)
      expect(await readQueue(queueFile)).toEqual([])
      expect(subjects()).toEqual(['sync-things: ger upp sak A-1'])
      const body = sendEmailSpy.mock.calls[0][0].body as string
      expect(body).toContain('still down')
      expect(body).toContain('Gör ändringen i Xpand på nytt')
    })

    it('the give-up mail uses the definition’s advice when it has one', async () => {
      await appendEntry(
        queueFile,
        failedFor(30 * 24 + 1, {
          lastAttemptAt: hoursBefore(NOW, 24),
          stillFailingNotifiedAt: hoursBefore(NOW, 29 * 24),
        })
      )
      sync.mockRejectedValue(new Error('still down'))

      await run({ giveUpAdvice: 'Gör något annat.' })

      const body = sendEmailSpy.mock.calls[0][0].body as string
      expect(body).toContain('Gör något annat.')
      expect(body).not.toContain('Gör ändringen i Xpand på nytt')
    })

    it('a newer change for the same key starts a fresh clock', async () => {
      await appendEntry(
        queueFile,
        failedFor(30 * 24 + 1, { lastAttemptAt: hoursBefore(NOW, 1) })
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

  it('a queued row that sync skips is removed and mailed as skipped', async () => {
    await appendEntry(queueFile, entryFor(change()))
    sync.mockResolvedValue({ skipped: 'finns inte i Tenfast' })

    await run()

    expect(await readQueue(queueFile)).toEqual([])
    expect(subjects()).toEqual([
      'sync-things: tidigare felande sak A-1 synkades inte',
    ])
    expect(sendEmailSpy.mock.calls[0][0].body).toContain('finns inte i Tenfast')
  })

  it('a new row that sync skips sends no mail and saves its timestamp', async () => {
    const c = change()
    fetchChanges.mockResolvedValue({ ok: true, data: [c] })
    sync.mockResolvedValue({ skipped: 'finns inte i Tenfast' })

    await run()

    expect(sendEmailSpy).not.toHaveBeenCalled()
    expect(await readState()).toBe(c.timestamp.toISOString())
  })

  describe('supersedeKey', () => {
    const keyedByTimestamp = {
      keyFor: (c: Change) => `thing:${c.id}:${c.timestamp.toISOString()}`,
      supersedeKey: (c: Change) => c.id,
    }
    const older = change({ value: 'old' })
    const newer = change({
      value: 'new',
      timestamp: new Date('2026-10-15T08:10:00.000Z'),
    })

    it('drops a queued change that a fetched change replaces, without retrying it', async () => {
      await appendEntry(
        queueFile,
        entryFor(older, { key: keyedByTimestamp.keyFor(older) })
      )
      fetchChanges.mockResolvedValue({ ok: true, data: [newer] })

      await run(keyedByTimestamp)

      expect(sync.mock.calls.map(([c]) => c.value)).toEqual(['new'])
      expect(await readQueue(queueFile)).toEqual([])
      expect(subjects()).toEqual([
        'sync-things: tidigare felande sak A-1 ersatt av en senare ändring',
      ])
    })

    it('of two queued changes for one thing, retries only the newest', async () => {
      await appendEntry(
        queueFile,
        entryFor(older, { key: keyedByTimestamp.keyFor(older) })
      )
      await appendEntry(
        queueFile,
        entryFor(newer, { key: keyedByTimestamp.keyFor(newer) })
      )

      await run(keyedByTimestamp)

      expect(sync.mock.calls.map(([c]) => c.value)).toEqual(['new'])
      expect(await readQueue(queueFile)).toEqual([])
    })

    it('keeps queued changes for other things', async () => {
      const other = change({ id: 'B-2' })
      await appendEntry(
        queueFile,
        entryFor(other, { key: keyedByTimestamp.keyFor(other) })
      )
      fetchChanges.mockResolvedValue({ ok: true, data: [newer] })

      await run(keyedByTimestamp)

      expect(sync.mock.calls.map(([c]) => c.id)).toEqual(['B-2', 'A-1'])
    })
  })

  describe('until', () => {
    it('saves until when it is later than the last change', async () => {
      const c = change()
      fetchChanges.mockResolvedValue({
        ok: true,
        data: [c],
        until: new Date('2026-10-15T08:20:00.000Z'),
      })

      await run()

      expect(await readState()).toBe('2026-10-15T08:20:00.000Z')
    })

    it('saves until when no change was parsed', async () => {
      await fs.writeFile(stateFile, '2026-10-15T07:00:00.000Z', 'utf-8')
      fetchChanges.mockResolvedValue({
        ok: true,
        data: [],
        until: new Date('2026-10-15T08:20:00.000Z'),
      })

      await run()

      expect(await readState()).toBe('2026-10-15T08:20:00.000Z')
    })
  })

  describe('firstRun', () => {
    it('start-now: syncs nothing and saves until', async () => {
      const until = new Date('2026-10-15T08:20:00.000Z')
      fetchChanges.mockResolvedValue({ ok: true, data: [change()], until })

      await run({ firstRun: 'start-now' })

      expect(fetchChanges).toHaveBeenCalledWith(null)
      expect(sync).not.toHaveBeenCalled()
      expect(await readState()).toBe(until.toISOString())
    })

    it('start-now: saves the last change when there is no until', async () => {
      const c = change()
      fetchChanges.mockResolvedValue({ ok: true, data: [c] })

      await run({ firstRun: 'start-now' })

      expect(sync).not.toHaveBeenCalled()
      expect(await readState()).toBe(c.timestamp.toISOString())
    })

    it('start-now: saves now when cmlog has nothing', async () => {
      await run({ firstRun: 'start-now' })

      expect(await readState()).toBe(NOW.toISOString())
    })

    it('start-now: syncs as usual once a timestamp is saved', async () => {
      await fs.writeFile(stateFile, '2026-10-15T07:00:00.000Z', 'utf-8')
      const c = change()
      fetchChanges.mockResolvedValue({ ok: true, data: [c] })

      await run({ firstRun: 'start-now' })

      expect(sync).toHaveBeenCalledWith(c)
    })
  })

  describe('rows in the same second', () => {
    it('saves the timestamp only after the last row of a second', async () => {
      const first = change({ id: 'A-1' })
      const second = change({ id: 'A-2' })
      const later = change({
        id: 'A-3',
        timestamp: new Date('2026-10-15T08:00:01.000Z'),
      })
      fetchChanges.mockResolvedValue({
        ok: true,
        data: [first, second, later],
      })
      const statesSeen: (string | null)[] = []
      sync.mockImplementation(async () => {
        statesSeen.push(await readState().catch(() => null))
      })

      await run()

      expect(statesSeen).toEqual([null, null, first.timestamp.toISOString()])
      expect(await readState()).toBe(later.timestamp.toISOString())
    })
  })

  it('throws without syncing when the timestamp file cannot be read', async () => {
    await fs.writeFile(stateFile, 'not-a-date', 'utf-8')

    await expect(run()).rejects.toThrow()

    expect(fetchChanges).not.toHaveBeenCalled()
    expect(sync).not.toHaveBeenCalled()
  })

  it('still retries the queue when fetching fails', async () => {
    await appendEntry(queueFile, entryFor(change()))
    fetchChanges.mockResolvedValue({ ok: false, err: 'unknown' })

    await expect(run()).rejects.toThrow('unknown')
    expect(sync).toHaveBeenCalledTimes(1)
    expect(await readQueue(queueFile)).toEqual([])
  })

  describe('orderKey', () => {
    const ordered: Partial<CmlogSync<Change>> = {
      keyFor: (c) => `thing:${c.id}:${c.value}`,
      orderKey: (c) => c.id,
      describe: (c) => ({
        subject: `sak ${c.id}`,
        detail: `sak ${c.id} (${c.value})`,
      }),
    }
    const create = change({ id: 'L-1', value: 'create' })
    const terminate = change({
      id: 'L-1',
      value: 'terminate',
      timestamp: new Date('2026-10-15T08:05:00.000Z'),
    })
    const voided = change({
      id: 'L-1',
      value: 'void',
      timestamp: new Date('2026-10-15T08:10:00.000Z'),
    })
    const queuedCreate = entryFor(create, { key: 'thing:L-1:create' })
    const heldEntry = (c: Change): FailedRowEntry => ({
      key: `thing:${c.id}:${c.value}`,
      type: 'rental-object-type',
      payload: { ...c, timestamp: c.timestamp.toISOString() },
      addedAt: '2026-10-15T00:00:00.000Z',
      lastError: 'Väntar på sak L-1 (create)',
      heldBehind: 'thing:L-1:create',
    })
    const failOn = (value: string) =>
      sync.mockImplementation(async (c: Change) => {
        if (c.value === value) throw new Error('boom')
      })

    it('holds a new row behind a queued create for the same thing, unsynced and unmailed', async () => {
      await appendEntry(queueFile, queuedCreate)
      fetchChanges.mockResolvedValue({ ok: true, data: [terminate] })
      failOn('create')

      await run(ordered)

      expect(sync).toHaveBeenCalledTimes(1)
      expect(sync).toHaveBeenCalledWith(create)
      const queue = await readQueue(queueFile)
      expect(queue.map((e) => e.key)).toEqual([
        'thing:L-1:create',
        'thing:L-1:terminate',
      ])
      expect(queue[1]).toMatchObject({
        heldBehind: 'thing:L-1:create',
        lastError: 'Väntar på sak L-1 (create)',
      })
      expect(queue[1].lastAttemptAt).toBeUndefined()
      expect(subjects()).toEqual([])
      expect(await readState()).toBe(terminate.timestamp.toISOString())
    })

    it('holds a row behind a create that failed earlier in the same run', async () => {
      fetchChanges.mockResolvedValue({ ok: true, data: [create, terminate] })
      failOn('create')

      await run(ordered)

      expect(sync).toHaveBeenCalledTimes(1)
      const queue = await readQueue(queueFile)
      expect(queue.map((e) => e.key)).toEqual([
        'thing:L-1:create',
        'thing:L-1:terminate',
      ])
      expect(queue[1].heldBehind).toBe('thing:L-1:create')
      expect(subjects()).toEqual(['sync-things: nytt fel på sak L-1'])
    })

    it('holds a new row behind a queued row for the same thing that is not a create', async () => {
      await appendEntry(
        queueFile,
        entryFor(terminate, { key: 'thing:L-1:terminate' })
      )
      fetchChanges.mockResolvedValue({ ok: true, data: [voided] })
      failOn('terminate')

      await run(ordered)

      expect(sync.mock.calls.map(([c]) => (c as Change).value)).toEqual([
        'terminate',
      ])
      const queue = await readQueue(queueFile)
      expect(queue.map((e) => e.key)).toEqual([
        'thing:L-1:terminate',
        'thing:L-1:void',
      ])
      expect(queue[1].heldBehind).toBe('thing:L-1:terminate')
    })

    it('does not hold a row behind a create for another thing', async () => {
      await appendEntry(queueFile, queuedCreate)
      const other = change({ id: 'L-2', value: 'terminate' })
      fetchChanges.mockResolvedValue({ ok: true, data: [other] })
      failOn('create')

      await run(ordered)

      expect(sync).toHaveBeenCalledWith(other)
      expect((await readQueue(queueFile)).map((e) => e.key)).toEqual([
        'thing:L-1:create',
      ])
    })

    it('keeps held rows untouched while the create still fails', async () => {
      await appendEntry(queueFile, queuedCreate)
      await appendEntry(queueFile, heldEntry(terminate))
      failOn('create')

      await run(ordered)

      expect(sync).toHaveBeenCalledTimes(1)
      expect(sync).toHaveBeenCalledWith(create)
      const queue = await readQueue(queueFile)
      expect(queue).toHaveLength(2)
      expect(queue[1]).toEqual(heldEntry(terminate))
      expect(subjects()).toEqual([])
    })

    it('runs held rows in order once the create syncs, with no mail for them', async () => {
      await appendEntry(queueFile, queuedCreate)
      await appendEntry(queueFile, heldEntry(terminate))
      await appendEntry(queueFile, heldEntry(voided))

      await run(ordered)

      expect(sync.mock.calls.map(([c]) => (c as Change).value)).toEqual([
        'create',
        'terminate',
        'void',
      ])
      expect(await readQueue(queueFile)).toEqual([])
      expect(subjects()).toEqual([
        'sync-things: tidigare felande sak L-1 är nu synkat',
      ])
    })

    it('a held row that fails once released is queued as a new failure and mailed', async () => {
      await appendEntry(queueFile, queuedCreate)
      await appendEntry(queueFile, heldEntry(terminate))
      failOn('terminate')

      await run(ordered)

      const queue = await readQueue(queueFile)
      expect(queue).toHaveLength(1)
      expect(queue[0]).toMatchObject({
        key: 'thing:L-1:terminate',
        addedAt: NOW.toISOString(),
        lastError: 'boom',
        lastAttemptAt: NOW.toISOString(),
      })
      expect(queue[0].heldBehind).toBeUndefined()
      expect(subjects()).toEqual([
        'sync-things: tidigare felande sak L-1 är nu synkat',
        'sync-things: nytt fel på sak L-1',
      ])
    })

    it('keeps the next held row waiting behind a released row that fails', async () => {
      await appendEntry(queueFile, queuedCreate)
      await appendEntry(queueFile, heldEntry(terminate))
      await appendEntry(queueFile, heldEntry(voided))
      failOn('terminate')

      await run(ordered)

      expect(sync.mock.calls.map(([c]) => (c as Change).value)).toEqual([
        'create',
        'terminate',
      ])
      const queue = await readQueue(queueFile)
      expect(queue.map((e) => e.key)).toEqual([
        'thing:L-1:terminate',
        'thing:L-1:void',
      ])
      expect(queue[1]).toEqual(heldEntry(voided))
    })

    it('mails when a released held row is skipped', async () => {
      await appendEntry(queueFile, queuedCreate)
      await appendEntry(queueFile, heldEntry(terminate))
      sync.mockImplementation(async (c: Change) =>
        c.value === 'terminate' ? { skipped: 'lease not found' } : undefined
      )

      await run(ordered)

      expect(await readQueue(queueFile)).toEqual([])
      expect(subjects()).toEqual([
        'sync-things: tidigare felande sak L-1 är nu synkat',
        'sync-things: sak L-1 synkades inte',
      ])
      expect(sendEmailSpy.mock.calls[1][0].body).toContain('lease not found')
    })

    it('keeps a queued row ahead of its held rows when it fails again on a newer change', async () => {
      await appendEntry(queueFile, queuedCreate)
      await appendEntry(queueFile, heldEntry(terminate))
      const newerCreate = change({
        id: 'L-1',
        value: 'create',
        timestamp: new Date('2026-10-15T08:20:00.000Z'),
      })
      fetchChanges.mockResolvedValue({ ok: true, data: [newerCreate] })
      failOn('create')

      await run(ordered)

      expect((await readQueue(queueFile)).map((e) => e.key)).toEqual([
        'thing:L-1:create',
        'thing:L-1:terminate',
      ])
    })

    it('does not sync a re-fetched row dropped with a given-up create', async () => {
      await appendEntry(
        queueFile,
        entryFor(create, {
          key: 'thing:L-1:create',
          retriesStartedAt: hoursBefore(NOW, 31 * 24),
          lastAttemptAt: hoursBefore(NOW, 25),
        })
      )
      await appendEntry(queueFile, heldEntry(terminate))
      fetchChanges.mockResolvedValue({ ok: true, data: [terminate] })
      failOn('create')

      await run(ordered)

      expect(sync.mock.calls.map(([c]) => (c as Change).value)).toEqual([
        'create',
      ])
      expect(await readQueue(queueFile)).toEqual([])
    })

    it('does not sync a re-fetched held row twice once released', async () => {
      await appendEntry(queueFile, queuedCreate)
      await appendEntry(queueFile, heldEntry(terminate))
      fetchChanges.mockResolvedValue({ ok: true, data: [terminate] })

      await run(ordered)

      expect(sync.mock.calls.map(([c]) => (c as Change).value)).toEqual([
        'create',
        'terminate',
      ])
    })

    it('drops held rows replaced by a newer change instead of releasing them', async () => {
      await appendEntry(queueFile, queuedCreate)
      await appendEntry(queueFile, heldEntry(terminate))
      fetchChanges.mockResolvedValue({ ok: true, data: [voided] })

      await run({ ...ordered, supersedeKey: (c) => c.id })

      expect(sync.mock.calls.map(([c]) => (c as Change).value)).toEqual([
        'void',
      ])
      expect(await readQueue(queueFile)).toEqual([])
      expect(subjects()).toEqual([
        'sync-things: tidigare felande sak L-1 ersatt av en senare ändring',
      ])
    })

    it('drops held rows when the create is given up and names them in the mail', async () => {
      await appendEntry(
        queueFile,
        entryFor(create, {
          key: 'thing:L-1:create',
          retriesStartedAt: hoursBefore(NOW, 31 * 24),
          lastAttemptAt: hoursBefore(NOW, 25),
        })
      )
      await appendEntry(queueFile, heldEntry(terminate))
      await appendEntry(queueFile, heldEntry(voided))
      failOn('create')

      await run(ordered)

      expect(sync).toHaveBeenCalledTimes(1)
      expect(await readQueue(queueFile)).toEqual([])
      expect(subjects()).toEqual(['sync-things: ger upp sak L-1'])
      expect(sendEmailSpy.mock.calls[0][0].body).toContain(
        'sak L-1 (terminate), sak L-1 (void)'
      )
    })

    it('leaves a re-fetched held row waiting', async () => {
      await appendEntry(queueFile, queuedCreate)
      await appendEntry(queueFile, heldEntry(terminate))
      fetchChanges.mockResolvedValue({ ok: true, data: [terminate] })
      failOn('create')

      await run(ordered)

      expect(sync).toHaveBeenCalledTimes(1)
      const queue = await readQueue(queueFile)
      expect(queue).toHaveLength(2)
      expect(queue[1]).toEqual(heldEntry(terminate))
    })
  })

  it('throws when fetching fails and leaves the timestamp alone', async () => {
    await fs.writeFile(stateFile, '2026-10-15T07:00:00.000Z', 'utf-8')
    fetchChanges.mockResolvedValue({ ok: false, err: 'unknown' })

    await expect(run()).rejects.toThrow('unknown')
    expect(await readState()).toBe('2026-10-15T07:00:00.000Z')
  })
})
