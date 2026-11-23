import { Knex } from 'knex'
import { ConnectionPool } from 'mssql'
import config from '@src/common/config'
import { xpandDbClient } from '@src/adapters/xpand/db'
import { contactsDbClient } from '@src/adapters/db'
import { xpandContactsRepository } from '@src/adapters/xpand/repository'
import { cmlogContactChanges } from '@src/adapters/xpand/query'
import { requireXpandTestDb } from '../../db-support'
import { connect, prepareDataSet } from '../../e2e/app-fixture'
import { FULL_TEST_DATA_SET } from '../../e2e/data-set'

requireXpandTestDb()

const CONTACT_TABLE = '_RXJ0UWYHC'

// keycmctc of the seeded contacts
const KEY: Record<string, string> = {
  P000111: '_0J4157AAA',
  P000222: '_0J4157BBB',
  P000333: '_0J4157CCC',
}

const xpandResource = xpandDbClient(config.xpandDatabase)
const contactsResource = contactsDbClient(config.contactsDatabase)
let pool: ConnectionPool
let xpand: Knex

const code = 'P000111'
const t1 = new Date('2026-01-01T10:00:00.000Z')
const t2 = new Date('2026-01-01T11:00:00.000Z')
const t3 = new Date('2026-01-01T12:00:00.000Z')

let seq = 0
const addLog = (logcat: string | null, logtime: Date, contactCode = code) =>
  xpand('cmlog').insert({
    keycmlog: `L${String(++seq).padStart(6, '0')}`,
    keydbtbl: CONTACT_TABLE,
    keycode: KEY[contactCode],
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
  pool = await connect()
  await prepareDataSet(pool, FULL_TEST_DATA_SET)
  await xpandResource.init()
  await contactsResource.init()
  xpand = xpandResource.get()
})

beforeEach(async () => {
  await xpand('cmlog').del()
})

afterAll(async () => {
  await xpand('cmlog').del()
  await xpandResource.close()
  await contactsResource.close()
  await pool.close()
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
    await addLog('Värde ändrat', t3, 'P000222')
    await addLog('E-post skickat', t3, 'P000333')

    expect(await cmlogContactChanges(xpand, t2)).toEqual([
      { contactCode: 'P000222', timestamp: t3 },
    ])
  })
})
