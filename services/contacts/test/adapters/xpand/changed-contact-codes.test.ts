import { Knex } from 'knex'
import { ConnectionPool } from 'mssql'
import config from '@src/common/config'
import { xpandDbClient } from '@src/adapters/xpand/db'
import { cmlogContactChanges } from '@src/adapters/xpand/query'
import { connect, prepareDataSet } from '../../e2e/app-fixture'
import { FULL_TEST_DATA_SET } from '../../e2e/data-set'

const CONTACT_TABLE = '_RXJ0UWYHC'
const OTHER_TABLE = '_03Z0S9PRA'

// keycmctc of the seeded contacts
const KEY = {
  P000111: '_0J4157AAA',
  P000222: '_0J4157BBB',
  P000333: '_0J4157CCC',
  P000444: '_0J4157DDD',
  P000555: '_0J4157EEE',
}

const T1 = new Date('2026-03-01T10:00:00.000Z')
const T2 = new Date('2026-03-02T10:00:00.000Z')
const T3 = new Date('2026-03-03T10:00:00.000Z')

type LogRow = {
  table?: string
  keycode: string
  logtime: Date
  memo: string
}

const xpandResource = xpandDbClient(config.xpandDatabase)
let pool: ConnectionPool
let xpand: Knex

const setLog = async (rows: LogRow[]) => {
  await pool.request().query('DELETE FROM cmlog')
  let i = 0
  for (const row of rows) {
    i++
    await pool
      .request()
      .input('key', `LOG${String(i).padStart(4, '0')}`)
      .input('tbl', row.table ?? CONTACT_TABLE)
      .input('code', row.keycode)
      .input('time', row.logtime)
      .input('memo', row.memo)
      .query(
        'INSERT INTO cmlog (keycmlog, keydbtbl, keycode, logtime, logmemo) VALUES (@key, @tbl, @code, @time, @memo)'
      )
  }
}

const run = async (since: Date | null = null) =>
  (await cmlogContactChanges(xpand, since)).map((r) => ({
    contactCode: r.contactCode?.trim(),
    timestamp: r.timestamp,
  }))

beforeAll(async () => {
  pool = await connect()
  await prepareDataSet(pool, FULL_TEST_DATA_SET)
  await xpandResource.init()
  xpand = xpandResource.get()
})

afterAll(async () => {
  await pool.request().query('DELETE FROM cmlog')
  await xpandResource.close()
  await pool.close()
})

describe('cmlogContactChanges', () => {
  it('returns the contact the keycode points at, not the code in the memo', async () => {
    await setLog([
      { keycode: KEY.P000222, logtime: T1, memo: 'Kontakt P000111' },
    ])

    expect(await run()).toEqual([{ contactCode: 'P000222', timestamp: T1 }])
  })

  it('ignores lines on other tables', async () => {
    await setLog([
      {
        table: OTHER_TABLE,
        keycode: KEY.P000333,
        logtime: T1,
        memo: 'Kontakt P000333',
      },
    ])

    expect(await run()).toEqual([])
  })

  it('ignores lines whose keycode matches no contact', async () => {
    await setLog([
      { keycode: '_NOSUCHKEY', logtime: T1, memo: 'Kontakt P000111' },
    ])

    expect(await run()).toEqual([])
  })

  it('returns a contact whose code never changed', async () => {
    await setLog([
      { keycode: KEY.P000444, logtime: T1, memo: 'Kontakt P000444' },
    ])

    expect(await run()).toEqual([{ contactCode: 'P000444', timestamp: T1 }])
  })

  it('ignores lines whose memo does not start with "Kontakt "', async () => {
    await setLog([
      { keycode: KEY.P000555, logtime: T1, memo: 'Adress P000555' },
    ])

    expect(await run()).toEqual([])
  })

  it('returns one entry per contact with the latest logtime', async () => {
    await setLog([
      { keycode: KEY.P000111, logtime: T2, memo: 'Kontakt P000111' },
      { keycode: KEY.P000111, logtime: T1, memo: 'Kontakt P000111' },
    ])

    expect(await run()).toEqual([{ contactCode: 'P000111', timestamp: T2 }])
  })

  it('filters on since and orders by timestamp ascending', async () => {
    await setLog([
      { keycode: KEY.P000333, logtime: T3, memo: 'Kontakt P000333' },
      { keycode: KEY.P000111, logtime: T1, memo: 'Kontakt P000111' },
      { keycode: KEY.P000222, logtime: T2, memo: 'Kontakt P000222' },
    ])

    expect(await run()).toEqual([
      { contactCode: 'P000111', timestamp: T1 },
      { contactCode: 'P000222', timestamp: T2 },
      { contactCode: 'P000333', timestamp: T3 },
    ])
    expect(await run(new Date('2026-03-01T12:00:00.000Z'))).toEqual([
      { contactCode: 'P000222', timestamp: T2 },
      { contactCode: 'P000333', timestamp: T3 },
    ])
  })
})
