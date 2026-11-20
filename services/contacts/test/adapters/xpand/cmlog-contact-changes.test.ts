import { Knex } from 'knex'
import config from '@src/common/config'
import { xpandDbClient } from '@src/adapters/xpand/db'
import { contactsDbClient } from '@src/adapters/db'
import { xpandContactsRepository } from '@src/adapters/xpand/repository'
import { cmlogContactChanges } from '@src/adapters/xpand/query'
import { requireXpandTestDb } from '../../db-support'
import { FULL_TEST_DATA_SET } from '../../e2e/data-set'

requireXpandTestDb()

const xpandResource = xpandDbClient(config.xpandDatabase)
const contactsResource = contactsDbClient(config.contactsDatabase)
let xpand: Knex

const code = FULL_TEST_DATA_SET[0]
const t1 = new Date('2026-01-01T10:00:00.000Z')
const t2 = new Date('2026-01-01T11:00:00.000Z')
const t3 = new Date('2026-01-01T12:00:00.000Z')

let seq = 0
const addLog = (logcat: string | null, logtime: Date, contactCode = code) =>
  xpand('cmlog').insert({
    keycmlog: `L${String(++seq).padStart(6, '0')}`,
    keydbtbl: 'cmctc',
    keycode: contactCode,
    logtime,
    logcat,
    logmemo: `Kontakt ${contactCode}`,
  })

const changed = () =>
  xpandContactsRepository(
    xpandResource,
    contactsResource
  ).getChangedContactCodes(null)

beforeAll(async () => {
  await xpandResource.init()
  xpand = xpandResource.get()
})

beforeEach(async () => {
  await xpand('cmlog').del()
})

afterAll(async () => {
  await xpand('cmlog').del()
  await xpandResource.close()
})

describe('getChangedContactCodes message categories', () => {
  it.each(['SMS har skapats', 'E-post skickat', 'Skickad via SMS'])(
    'ignores a "%s" line',
    async (logcat) => {
      await addLog(logcat, t1)
      expect(await changed()).toEqual([])
    }
  )

  it('keeps the contact when a message line comes before a real change', async () => {
    await addLog('E-post skickat', t1)
    await addLog('Värde ändrat', t2)
    expect(await changed()).toEqual([{ contactCode: code, timestamp: t2 }])
  })

  it('does not move the timestamp when a message line comes after a real change', async () => {
    await addLog('Värde ändrat', t1)
    await addLog('E-post skickat', t2)
    expect(await changed()).toEqual([{ contactCode: code, timestamp: t1 }])
  })

  it('returns a line with an unknown category', async () => {
    await addLog('Kontakt skapad', t1)
    expect(await changed()).toEqual([{ contactCode: code, timestamp: t1 }])
  })

  it('returns a line with no category', async () => {
    await addLog(null, t1)
    expect(await changed()).toEqual([{ contactCode: code, timestamp: t1 }])
  })
})

describe('cmlogContactChanges', () => {
  it('returns only kept lines after since', async () => {
    await addLog('Värde ändrat', t1)
    await addLog('Värde ändrat', t3, FULL_TEST_DATA_SET[1])
    await addLog('E-post skickat', t3, FULL_TEST_DATA_SET[2])

    const rows = await cmlogContactChanges(xpand, t2)

    expect(rows.map((r) => r['logmemo'])).toEqual([
      `Kontakt ${FULL_TEST_DATA_SET[1]}`,
    ])
  })
})
