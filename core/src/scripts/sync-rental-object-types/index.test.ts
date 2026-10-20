import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import type { RentalObjectTypeChange } from '@onecore/types'

import config from '../../common/config'
import { syncRentalObjectTypes } from './index'
import { readQueue } from '../shared/failed-sync-queue'
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

const subjects = () =>
  sendEmailSpy.mock.calls.map(([email]) => email.subject as string)

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
  it('first run: syncs every change in cmlog', async () => {
    await fs.rm(stateFile)
    const c = change()
    const getChanges = mockChanges([c])
    mockSync().mockResolvedValue({ ok: true, data: { action: 'unchanged' } })

    await syncRentalObjectTypes({ stateFile, queueFile })

    expect(getChanges).toHaveBeenCalledWith(null)
    expect(await readState()).toBe(c.timestamp.toISOString())
  })

  it('syncs each change since the saved timestamp and sends no mail', async () => {
    const c = change()
    const getChanges = mockChanges([c])
    const sync = mockSync().mockResolvedValue({
      ok: true,
      data: { action: 'updated' },
    })

    await syncRentalObjectTypes({ stateFile, queueFile })

    expect(getChanges).toHaveBeenCalledWith(START)
    expect(sync).toHaveBeenCalledWith('807-033-01-0101', 'POÄNGFRITT')
    expect(sendEmailSpy).not.toHaveBeenCalled()
    expect(await readState()).toBe(c.timestamp.toISOString())
  })

  it('a failed sync is queued under the rental object and mailed', async () => {
    mockChanges([change()])
    mockSync().mockResolvedValue({
      ok: false,
      err: 'sync-failed',
      statusCode: 500,
    })

    await syncRentalObjectTypes({ stateFile, queueFile })

    const queue = await readQueue(queueFile)
    expect(queue).toHaveLength(1)
    expect(queue[0]).toMatchObject({
      key: 'rental-object-type:807-033-01-0101',
      type: 'rental-object-type',
      lastError: 'sync-failed (status 500)',
    })
    expect(subjects()).toEqual([
      'sync-rental-object-types: nytt fel på hyresobjekt 807-033-01-0101',
    ])
  })

  it('an unknown type is mailed once and not queued', async () => {
    mockChanges([change({ code: 'HDK', label: 'Handikappanpassad' })])
    mockSync().mockResolvedValue({
      ok: false,
      err: 'unknown-type',
      statusCode: 422,
    })

    await syncRentalObjectTypes({ stateFile, queueFile })

    expect(await readQueue(queueFile)).toEqual([])
    expect(subjects()).toEqual([
      'sync-rental-object-types: hyresobjekt 807-033-01-0101 kan inte synkas',
    ])
    expect(sendEmailSpy.mock.calls[0][0].body).toContain(
      "hyresobjektstyp 'HDK'"
    )
    expect(sendEmailSpy.mock.calls[0][0].body).toContain(
      'TENFAST_RENTAL_OBJECT_CATEGORIES'
    )
  })

  it('a cleared type shows the code as empty quotes', async () => {
    mockChanges([change({ code: null, label: null })])
    mockSync().mockResolvedValue({ ok: false, err: 'unknown-type' })

    await syncRentalObjectTypes({ stateFile, queueFile })

    expect(sendEmailSpy.mock.calls[0][0].body).toContain("hyresobjektstyp ''")
  })

  it('a change Tenfast rejects is mailed once and not queued', async () => {
    mockChanges([change()])
    mockSync().mockResolvedValue({
      ok: false,
      err: 'rejected',
      statusCode: 422,
    })

    await syncRentalObjectTypes({ stateFile, queueFile })

    expect(await readQueue(queueFile)).toEqual([])
    expect(subjects()).toEqual([
      'sync-rental-object-types: hyresobjekt 807-033-01-0101 kan inte synkas',
    ])
    expect(sendEmailSpy.mock.calls[0][0].body).toContain('Tenfast avvisade')
  })
})
