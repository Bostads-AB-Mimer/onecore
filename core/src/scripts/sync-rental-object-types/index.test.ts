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

const change = (
  overrides: Partial<RentalObjectTypeChange> = {}
): RentalObjectTypeChange => ({
  rentalObjectCode: '807-033-01-0101',
  code: 'POÄNGFRITT',
  label: 'Poängfritt',
  timestamp: new Date('2026-10-15T08:08:28.000Z'),
  ...overrides,
})

const queuedEntry = (c: RentalObjectTypeChange): FailedRowEntry => ({
  key: `rental-object-type:${c.rentalObjectCode}`,
  type: 'rental-object-type',
  payload: { ...c, timestamp: c.timestamp.toISOString() },
  addedAt: '2026-10-15T00:00:00.000Z',
  lastError: 'sync-failed (status 500)',
})

let dir: string
let stateFile: string
let queueFile: string
let sendEmailSpy: jest.SpyInstance

const originalXpandSync = config.emailAddresses.xpandSync

const readState = async () => (await fs.readFile(stateFile, 'utf-8')).trim()

const mockChanges = (changes: RentalObjectTypeChange[]) =>
  jest
    .spyOn(leasingAdapter, 'getRentalObjectTypeChanges')
    .mockResolvedValue({ ok: true, data: changes })

const mockSync = () => jest.spyOn(leasingAdapter, 'syncRentalObjectType')

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'srot-'))
  stateFile = path.join(dir, 'last-timestamp-rental-object-types.txt')
  queueFile = path.join(dir, 'failed-rows.jsonl')
  await fs.writeFile(stateFile, START.toISOString(), 'utf-8')
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
  it('first run: saves the current time and makes no calls', async () => {
    await fs.rm(stateFile)
    const getChanges = mockChanges([])
    const sync = mockSync()
    const before = Date.now()

    await syncRentalObjectTypes({ stateFile, queueFile })

    const saved = new Date(await readState()).getTime()
    expect(saved).toBeGreaterThanOrEqual(before)
    expect(saved).toBeLessThanOrEqual(Date.now())
    expect(getChanges).not.toHaveBeenCalled()
    expect(sync).not.toHaveBeenCalled()
  })

  it('happy path: syncs, sends no mail, advances the timestamp', async () => {
    const c = change()
    const getChanges = mockChanges([c])
    mockSync().mockResolvedValue({ ok: true, data: { action: 'updated' } })

    await syncRentalObjectTypes({ stateFile, queueFile })

    expect(getChanges).toHaveBeenCalledWith(START)
    expect(leasingAdapter.syncRentalObjectType).toHaveBeenCalledWith(
      '807-033-01-0101',
      'POÄNGFRITT'
    )
    expect(sendEmailSpy).not.toHaveBeenCalled()
    expect(await readQueue(queueFile)).toEqual([])
    expect(await readState()).toBe(c.timestamp.toISOString())
  })

  it('failure: queues the change and sends one failure mail', async () => {
    const c = change()
    mockChanges([c])
    mockSync().mockResolvedValue({
      ok: false,
      err: 'sync-failed',
      statusCode: 500,
    })

    await syncRentalObjectTypes({ stateFile, queueFile })

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
    expect(await readState()).toBe(c.timestamp.toISOString())
  })

  it('crashed run redone: same change already queued sends no mail', async () => {
    const c = change()
    await addEntry(queueFile, queuedEntry(c))
    mockChanges([c])
    mockSync().mockResolvedValue({ ok: false, err: 'sync-failed' })

    await syncRentalObjectTypes({ stateFile, queueFile })

    expect(sendEmailSpy).not.toHaveBeenCalled()
    expect(await readQueue(queueFile)).toHaveLength(1)
  })

  it('newer failure replaces the stale queue entry', async () => {
    const older = change({
      code: 'STD',
      label: 'Standard hyresobjektstyp',
      timestamp: new Date('2026-10-15T08:00:00.000Z'),
    })
    const newer = change({ timestamp: new Date('2026-10-15T08:10:00.000Z') })
    await addEntry(queueFile, queuedEntry(older))
    mockChanges([newer])
    mockSync().mockResolvedValue({ ok: false, err: 'sync-failed' })

    await syncRentalObjectTypes({ stateFile, queueFile })

    const queue = await readQueue(queueFile)
    expect(queue).toHaveLength(1)
    expect((queue[0].payload as { code: string }).code).toBe('POÄNGFRITT')
    expect(sendEmailSpy).toHaveBeenCalledTimes(1)
  })

  it('newer success drops the stale queue entry', async () => {
    const older = change({
      code: 'STD',
      label: 'Standard hyresobjektstyp',
      timestamp: new Date('2026-10-15T08:00:00.000Z'),
    })
    const newer = change({ timestamp: new Date('2026-10-15T08:10:00.000Z') })
    await addEntry(queueFile, queuedEntry(older))
    mockChanges([newer])
    mockSync().mockImplementation(async (_rentalObjectCode, code) =>
      code === 'STD'
        ? { ok: false, err: 'sync-failed' }
        : { ok: true, data: { action: 'updated' } }
    )

    await syncRentalObjectTypes({ stateFile, queueFile })

    expect(await readQueue(queueFile)).toEqual([])
    expect(sendEmailSpy).not.toHaveBeenCalled()
  })

  it('unknown type: mails once and does not queue', async () => {
    const c = change({ code: 'HDK', label: 'Handikappanpassad' })
    mockChanges([c])
    mockSync().mockResolvedValue({
      ok: false,
      err: 'unknown-type',
      statusCode: 422,
    })

    await syncRentalObjectTypes({ stateFile, queueFile })

    expect(await readQueue(queueFile)).toEqual([])
    expect(sendEmailSpy).toHaveBeenCalledTimes(1)
    expect(sendEmailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining(
          "okänd hyresobjektstyp 'HDK' på hyresobjekt 807-033-01-0101"
        ),
      })
    )
    expect(await readState()).toBe(c.timestamp.toISOString())
  })

  it('unknown type for a cleared type shows the code as empty quotes', async () => {
    mockChanges([change({ code: null, label: null })])
    mockSync().mockResolvedValue({ ok: false, err: 'unknown-type' })

    await syncRentalObjectTypes({ stateFile, queueFile })

    expect(sendEmailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining("okänd hyresobjektstyp ''"),
      })
    )
  })

  it('queue retry success: removes the entry and sends a recovery mail', async () => {
    await addEntry(queueFile, queuedEntry(change()))
    mockChanges([])
    mockSync().mockResolvedValue({ ok: true, data: { action: 'updated' } })

    await syncRentalObjectTypes({ stateFile, queueFile })

    expect(await readQueue(queueFile)).toEqual([])
    expect(sendEmailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining('är nu synkat'),
      })
    )
  })

  it('queue retry still failing: keeps the entry and sends no mail', async () => {
    await addEntry(queueFile, queuedEntry(change()))
    mockChanges([])
    mockSync().mockResolvedValue({ ok: false, err: 'sync-failed' })

    await syncRentalObjectTypes({ stateFile, queueFile })

    expect(await readQueue(queueFile)).toHaveLength(1)
    expect(sendEmailSpy).not.toHaveBeenCalled()
  })

  it('leaves lease and contact entries in a shared queue file alone', async () => {
    const leaseEntry: FailedRowEntry = {
      key: 'L-1:create:2026-10-15T00:00:00.000Z',
      type: 'lease',
      payload: { leaseId: 'L-1' },
      addedAt: '2026-10-15T00:00:00.000Z',
      lastError: 'x',
    }
    await addEntry(queueFile, leaseEntry)
    mockChanges([])
    const sync = mockSync()

    await syncRentalObjectTypes({ stateFile, queueFile })

    expect(sync).not.toHaveBeenCalled()
    expect(await readQueue(queueFile)).toEqual([leaseEntry])
  })

  it('a failing mail does not stop the row from being queued and saved', async () => {
    const c = change()
    mockChanges([c])
    mockSync().mockResolvedValue({ ok: false, err: 'sync-failed' })
    sendEmailSpy.mockRejectedValue(new Error('smtp down'))

    await syncRentalObjectTypes({ stateFile, queueFile })

    expect(await readQueue(queueFile)).toHaveLength(1)
    expect(await readState()).toBe(c.timestamp.toISOString())
  })

  it('skips mail when no address is configured', async () => {
    ;(config.emailAddresses as Record<string, string>).xpandSync = ''
    mockChanges([change()])
    mockSync().mockResolvedValue({ ok: false, err: 'sync-failed' })

    await syncRentalObjectTypes({ stateFile, queueFile })

    expect(sendEmailSpy).not.toHaveBeenCalled()
    expect(await readQueue(queueFile)).toHaveLength(1)
  })

  it('throws when fetching changes fails and leaves the timestamp alone', async () => {
    jest
      .spyOn(leasingAdapter, 'getRentalObjectTypeChanges')
      .mockResolvedValue({ ok: false, err: 'unknown' })

    await expect(
      syncRentalObjectTypes({ stateFile, queueFile })
    ).rejects.toThrow('unknown')
    expect(await readState()).toBe(START.toISOString())
  })
})
