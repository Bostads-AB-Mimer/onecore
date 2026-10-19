import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import type { RentalObjectTypeChange } from '@onecore/types'

import config from '../../common/config'
import { syncRentalObjectTypes } from './index'
import {
  addEntry,
  readQueue,
  FailedRowEntry,
} from '../shared/failed-sync-queue'
import * as leasingAdapter from '../../adapters/leasing-adapter'
import * as communicationAdapter from '../../adapters/communication-adapter'

const START = new Date('2026-10-15T00:00:00.000Z')
const TWO_HOURS = 2 * 60 * 60 * 1000

const change = (
  overrides: Partial<RentalObjectTypeChange> = {}
): RentalObjectTypeChange => ({
  rentalObjectCode: '807-033-01-0101',
  code: 'POÄNGFRITT',
  label: 'Poängfritt',
  timestamp: new Date('2026-10-15T08:08:28.000Z'),
  ...overrides,
})

const queuedEntry = (
  c: RentalObjectTypeChange,
  addedAt = '2026-10-15T00:00:00.000Z'
): FailedRowEntry => ({
  key: `rental-object-type:${c.rentalObjectCode}`,
  type: 'rental-object-type',
  payload: { ...c, timestamp: c.timestamp.toISOString() },
  addedAt,
  lastError: 'sync-failed (status 500)',
})

let dir: string
let stateFile: string
let queueFile: string
let sendEmailSpy: jest.SpyInstance

const originalXpandSync = config.emailAddresses.xpandSync

const writeCheckpoint = (checkpoint: Date) =>
  fs.writeFile(stateFile, checkpoint.toISOString(), 'utf-8')

const readCheckpoint = async (): Promise<string> =>
  (await fs.readFile(stateFile, 'utf-8')).trim()

const run = (now?: Date) =>
  syncRentalObjectTypes({
    stateFile,
    queueFile,
    now: now ? () => now : undefined,
  })

const mockChanges = (changes: RentalObjectTypeChange[]) =>
  jest
    .spyOn(leasingAdapter, 'getRentalObjectTypeChanges')
    .mockResolvedValue({ ok: true, data: changes })

const mockSync = () => jest.spyOn(leasingAdapter, 'syncRentalObjectType')

const subjects = () =>
  sendEmailSpy.mock.calls.map(([email]) => email.subject as string)

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'srot-'))
  stateFile = path.join(dir, 'last-timestamp-rental-object-types.txt')
  queueFile = path.join(dir, 'failed-rows.jsonl')
  await writeCheckpoint(START)
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

describe('syncRentalObjectTypes', () => {
  describe('first run', () => {
    beforeEach(() => fs.rm(stateFile))

    it('saves Swedish summer wall-clock time and makes no calls', async () => {
      const getChanges = mockChanges([])
      const sync = mockSync()

      await run(new Date('2026-10-15T08:00:00.000Z'))

      expect(await readCheckpoint()).toBe('2026-10-15T10:00:00.000Z')
      expect(getChanges).not.toHaveBeenCalled()
      expect(sync).not.toHaveBeenCalled()
    })

    it('saves Swedish winter wall-clock time', async () => {
      await run(new Date('2026-12-01T08:00:00.000Z'))

      expect(await readCheckpoint()).toBe('2026-12-01T09:00:00.000Z')
    })
  })

  it('happy path: fetches with a two-hour overlap, syncs, sends no mail', async () => {
    const c = change()
    const getChanges = mockChanges([c])
    mockSync().mockResolvedValue({ ok: true, data: { action: 'updated' } })

    await run()

    expect(getChanges).toHaveBeenCalledWith(
      new Date(START.getTime() - TWO_HOURS)
    )
    expect(leasingAdapter.syncRentalObjectType).toHaveBeenCalledWith(
      '807-033-01-0101',
      'POÄNGFRITT'
    )
    expect(sendEmailSpy).not.toHaveBeenCalled()
    expect(await readQueue(queueFile)).toEqual([])
    expect(await readCheckpoint()).toBe(c.timestamp.toISOString())
  })

  it('failure: queues the change and sends one failure mail', async () => {
    const c = change()
    mockChanges([c])
    mockSync().mockResolvedValue({
      ok: false,
      err: 'sync-failed',
      statusCode: 500,
    })

    await run()

    const queue = await readQueue(queueFile)
    expect(queue).toHaveLength(1)
    expect(queue[0].key).toBe('rental-object-type:807-033-01-0101')
    expect(queue[0].type).toBe('rental-object-type')
    expect(sendEmailSpy).toHaveBeenCalledTimes(1)
    expect(sendEmailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'sync@example.com',
        subject: expect.stringContaining(
          'nytt fel på hyresobjekt 807-033-01-0101'
        ),
      })
    )
    expect(await readCheckpoint()).toBe(c.timestamp.toISOString())
  })

  it('crashed run redone: same change already queued sends no mail and keeps addedAt', async () => {
    const c = change()
    await addEntry(queueFile, queuedEntry(c, '2026-10-15T08:08:30.000Z'))
    mockChanges([c])
    mockSync().mockResolvedValue({ ok: false, err: 'sync-failed' })

    await run(new Date('2026-10-15T08:09:00.000Z'))

    expect(sendEmailSpy).not.toHaveBeenCalled()
    const queue = await readQueue(queueFile)
    expect(queue).toHaveLength(1)
    expect(queue[0].addedAt).toBe('2026-10-15T08:08:30.000Z')
  })

  it('newer failure replaces the stale queue entry without retrying it', async () => {
    const older = change({
      code: 'STD',
      label: 'Standard hyresobjektstyp',
      timestamp: new Date('2026-10-15T08:00:00.000Z'),
    })
    const newer = change({ timestamp: new Date('2026-10-15T08:10:00.000Z') })
    await addEntry(queueFile, queuedEntry(older))
    mockChanges([newer])
    const sync = mockSync().mockResolvedValue({
      ok: false,
      err: 'sync-failed',
    })

    await run()

    expect(sync.mock.calls).toEqual([['807-033-01-0101', 'POÄNGFRITT']])
    const queue = await readQueue(queueFile)
    expect(queue).toHaveLength(1)
    expect((queue[0].payload as { code: string }).code).toBe('POÄNGFRITT')
    expect(sendEmailSpy).toHaveBeenCalledTimes(1)
  })

  it('newer success drops the stale queue entry without retrying it and confirms by mail', async () => {
    const older = change({
      code: 'KORTTID',
      label: 'Korttidskontrakt',
      timestamp: new Date('2026-10-15T08:00:00.000Z'),
    })
    const newer = change({ timestamp: new Date('2026-10-15T08:10:00.000Z') })
    await addEntry(queueFile, queuedEntry(older))
    mockChanges([newer])
    const sync = mockSync().mockResolvedValue({
      ok: true,
      data: { action: 'updated' },
    })

    await run()

    expect(sync.mock.calls).toEqual([['807-033-01-0101', 'POÄNGFRITT']])
    expect(await readQueue(queueFile)).toEqual([])
    expect(sendEmailSpy).toHaveBeenCalledTimes(1)
    expect(sendEmailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining('är nu synkat'),
        body: expect.stringContaining("hyresobjektstyp 'POÄNGFRITT'"),
      })
    )
  })

  it('newer unknown type drops the stale queue entry without retrying it', async () => {
    const older = change({
      code: 'KORTTID',
      timestamp: new Date('2026-10-15T08:00:00.000Z'),
    })
    const newer = change({
      code: 'HDK',
      timestamp: new Date('2026-10-15T08:10:00.000Z'),
    })
    await addEntry(queueFile, queuedEntry(older))
    mockChanges([newer])
    const sync = mockSync().mockResolvedValue({
      ok: false,
      err: 'unknown-type',
    })

    await run()

    expect(sync.mock.calls).toEqual([['807-033-01-0101', 'HDK']])
    expect(await readQueue(queueFile)).toEqual([])
  })

  it('unknown type: mails once and does not queue', async () => {
    const c = change({ code: 'HDK', label: 'Handikappanpassad' })
    mockChanges([c])
    mockSync().mockResolvedValue({
      ok: false,
      err: 'unknown-type',
      statusCode: 422,
    })

    await run()

    expect(await readQueue(queueFile)).toEqual([])
    expect(subjects()).toEqual([
      expect.stringContaining(
        "okänd hyresobjektstyp 'HDK' på hyresobjekt 807-033-01-0101"
      ),
    ])
    expect(await readCheckpoint()).toBe(c.timestamp.toISOString())
  })

  it('unknown type for a cleared type shows the code as empty quotes', async () => {
    mockChanges([change({ code: null, label: null })])
    mockSync().mockResolvedValue({ ok: false, err: 'unknown-type' })

    await run()

    expect(subjects()).toEqual([
      expect.stringContaining("okänd hyresobjektstyp ''"),
    ])
  })

  it('rejected: mails once, does not queue and is not retried', async () => {
    mockChanges([change()])
    mockSync().mockResolvedValue({
      ok: false,
      err: 'rejected',
      statusCode: 422,
    })

    await run()

    expect(await readQueue(queueFile)).toEqual([])
    expect(subjects()).toEqual([
      expect.stringContaining('Tenfast avvisade hyresobjekt 807-033-01-0101'),
    ])
  })

  describe('retry queue', () => {
    it('updated: removes the entry and sends a recovery mail', async () => {
      await addEntry(queueFile, queuedEntry(change()))
      mockChanges([])
      mockSync().mockResolvedValue({ ok: true, data: { action: 'updated' } })

      await run()

      expect(await readQueue(queueFile)).toEqual([])
      expect(subjects()).toEqual([expect.stringContaining('är nu synkat')])
    })

    it('skipped: removes the entry and says the rental object is missing in Tenfast', async () => {
      await addEntry(queueFile, queuedEntry(change()))
      mockChanges([])
      mockSync().mockResolvedValue({ ok: true, data: { action: 'skipped' } })

      await run()

      expect(await readQueue(queueFile)).toEqual([])
      expect(subjects()).toEqual([
        expect.stringContaining(
          'hyresobjekt 807-033-01-0101 finns inte i Tenfast'
        ),
      ])
      expect(sendEmailSpy.mock.calls[0][0].body).not.toContain(
        'har nu hyresobjektstyp'
      )
    })

    it('rejected: removes the entry and sends a rejection mail', async () => {
      await addEntry(queueFile, queuedEntry(change()))
      mockChanges([])
      mockSync().mockResolvedValue({ ok: false, err: 'rejected' })

      await run()

      expect(await readQueue(queueFile)).toEqual([])
      expect(subjects()).toEqual([
        expect.stringContaining('Tenfast avvisade hyresobjekt'),
      ])
    })

    it('still failing: keeps the entry with the latest error and sends no mail', async () => {
      await addEntry(queueFile, queuedEntry(change()))
      mockChanges([])
      mockSync().mockResolvedValue({
        ok: false,
        err: 'sync-failed',
        statusCode: 503,
      })

      await run(new Date('2026-10-15T09:00:00.000Z'))

      const queue = await readQueue(queueFile)
      expect(queue).toHaveLength(1)
      expect(queue[0].addedAt).toBe('2026-10-15T00:00:00.000Z')
      expect(queue[0].lastError).toBe('sync-failed (status 503)')
      expect(sendEmailSpy).not.toHaveBeenCalled()
    })

    it('still failing after 24 hours: gives up, removes the entry and mails', async () => {
      await addEntry(
        queueFile,
        queuedEntry(change(), '2026-10-14T08:00:00.000Z')
      )
      mockChanges([])
      mockSync().mockResolvedValue({ ok: false, err: 'sync-failed' })

      await run(new Date('2026-10-15T08:00:01.000Z'))

      expect(await readQueue(queueFile)).toEqual([])
      expect(subjects()).toEqual([
        expect.stringContaining('ger upp hyresobjekt 807-033-01-0101'),
      ])
    })

    it('leaves lease and contact entries in a shared queue file alone', async () => {
      const leaseEntry: FailedRowEntry = {
        key: 'L-1:create:2026-10-15T00:00:00.000Z',
        type: 'lease',
        payload: { leaseId: 'L-1' },
        addedAt: '2026-10-01T00:00:00.000Z',
        lastError: 'x',
      }
      await addEntry(queueFile, leaseEntry)
      mockChanges([])
      const sync = mockSync()

      await run()

      expect(sync).not.toHaveBeenCalled()
      expect(await readQueue(queueFile)).toEqual([leaseEntry])
    })
  })

  it('a failing mail does not stop the row from being queued and saved', async () => {
    const c = change()
    mockChanges([c])
    mockSync().mockResolvedValue({ ok: false, err: 'sync-failed' })
    sendEmailSpy.mockRejectedValue(new Error('smtp down'))

    await run()

    expect(await readQueue(queueFile)).toHaveLength(1)
    expect(await readCheckpoint()).toBe(c.timestamp.toISOString())
  })

  it('skips mail when no address is configured', async () => {
    ;(config.emailAddresses as Record<string, string>).xpandSync = ''
    mockChanges([change()])
    mockSync().mockResolvedValue({ ok: false, err: 'sync-failed' })

    await run()

    expect(sendEmailSpy).not.toHaveBeenCalled()
    expect(await readQueue(queueFile)).toHaveLength(1)
  })

  describe('overlap window', () => {
    it('does not sync or mail a change again when the next fetch returns it', async () => {
      const t = new Date('2026-10-15T08:08:28.997Z')
      const a = change({ rentalObjectCode: 'A-1', code: 'HDK', timestamp: t })
      const b = change({ rentalObjectCode: 'B-2', timestamp: t })
      const sync = mockSync().mockImplementation(async (_code, type) =>
        type === 'HDK'
          ? { ok: false, err: 'unknown-type' }
          : { ok: true, data: { action: 'updated' } }
      )
      mockChanges([a])
      await run()

      mockChanges([a, b])
      await run()

      expect(sync.mock.calls.map(([code]) => code)).toEqual(['A-1', 'B-2'])
      expect(sendEmailSpy).toHaveBeenCalledTimes(1)
      expect(await readCheckpoint()).toBe(t.toISOString())
    })

    it('syncs a change logged before the checkpoint when clocks go back', async () => {
      const firstPass = change({
        rentalObjectCode: 'A-1',
        timestamp: new Date('2026-10-25T02:50:00.000Z'),
      })
      const secondPass = change({
        rentalObjectCode: 'B-2',
        timestamp: new Date('2026-10-25T02:10:00.000Z'),
      })
      const sync = mockSync().mockResolvedValue({
        ok: true,
        data: { action: 'updated' },
      })
      mockChanges([firstPass])
      await run()

      mockChanges([secondPass, firstPass])
      await run()

      expect(sync.mock.calls.map(([code]) => code)).toEqual(['A-1', 'B-2'])
      expect(await readCheckpoint()).toBe(firstPass.timestamp.toISOString())
    })

    it('syncs a second-pass change to the same rental object after its first-pass change', async () => {
      const firstPass = change({
        rentalObjectCode: 'A-1',
        code: 'STD',
        timestamp: new Date('2026-10-25T02:50:00.000Z'),
      })
      const secondPass = change({
        rentalObjectCode: 'A-1',
        code: 'POÄNGFRITT',
        timestamp: new Date('2026-10-25T02:10:00.000Z'),
      })
      const sync = mockSync().mockResolvedValue({
        ok: true,
        data: { action: 'updated' },
      })
      mockChanges([firstPass])
      await run()

      mockChanges([secondPass, firstPass])
      await run()

      expect(sync.mock.calls.map(([, code]) => code)).toEqual([
        'STD',
        'POÄNGFRITT',
      ])
    })

    it('syncs only the latest of several new changes to one rental object', async () => {
      const a1 = change({
        rentalObjectCode: 'A-1',
        code: 'STD',
        timestamp: new Date('2026-10-15T08:08:28.000Z'),
      })
      const a2 = change({
        rentalObjectCode: 'A-1',
        timestamp: new Date('2026-10-15T08:09:00.000Z'),
      })
      const sync = mockSync().mockResolvedValue({
        ok: true,
        data: { action: 'updated' },
      })
      mockChanges([a1, a2])

      await run()

      expect(sync.mock.calls).toEqual([['A-1', 'POÄNGFRITT']])
      expect(await readCheckpoint()).toBe(a2.timestamp.toISOString())
    })
  })

  it('throws when fetching changes fails and leaves the checkpoint alone', async () => {
    jest
      .spyOn(leasingAdapter, 'getRentalObjectTypeChanges')
      .mockResolvedValue({ ok: false, err: 'unknown' })

    await expect(run()).rejects.toThrow('unknown')
    expect(await readCheckpoint()).toBe(START.toISOString())
  })
})
