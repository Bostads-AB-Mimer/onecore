import { AxiosInstance } from 'axios'
import { ConnectionPool } from 'mssql'
import { connect, makeTestAppFixture, TestApp } from './app-fixture'
import { FULL_TEST_DATA_SET } from './data-set'

/** Table key of `cmctc` in cmlog.keydbtbl, as seen in the Xpand database. */
const CMCTC_TABLE_KEY = '_RXJ0UWYHC'
/** Table key of some other table whose log rows also start with "Kontakt". */
const OTHER_TABLE_KEY = '_03Z0S9PRA'

const keyOf = async (pool: ConnectionPool, contactCode: string) => {
  const result = await pool
    .request()
    .query(`SELECT keycmctc FROM cmctc WHERE cmctckod = '${contactCode}'`)
  return result.recordset[0].keycmctc as string
}

const logRow = (
  key: string,
  keycode: string | null,
  logtime: string,
  logmemo: string,
  keydbtbl: string = CMCTC_TABLE_KEY
) =>
  `INSERT INTO cmlog (keycmlog, keydbtbl, keycode, logtime, logcat, logmemo) VALUES ` +
  `('${key}', '${keydbtbl}', ${keycode ? `'${keycode}'` : 'NULL'}, '${logtime}', 'Kontakt skapad', '${logmemo}');`

describe('/contacts/sync', () => {
  let testApp: TestApp | undefined
  let httpClient: AxiosInstance

  beforeAll(async () => {
    testApp = await makeTestAppFixture({ dataSet: FULL_TEST_DATA_SET })

    const pool = await connect()
    const p333 = await keyOf(pool, 'P000333')
    const f111 = await keyOf(pool, 'F111111')

    // Rename P000444 the way the organisation conversion does, so its log row
    // still names the person code while the contact carries the new one.
    await pool.request().query(`
      UPDATE cmctc SET cmctckod = 'K000444' WHERE cmctckod = 'P000444'
    `)
    const k444 = await keyOf(pool, 'K000444')

    await pool.request().batch(
      [
        // The SOAP off-by-one: the text names a code that was never allocated,
        // the key points at the contact that was.
        logRow(
          '_LOG0000001    ',
          p333,
          '2026-09-01T10:00:00',
          'Kontakt P000332'
        ),
        // An ordinary Xpand-client row where text and key agree.
        logRow(
          '_LOG0000002    ',
          f111,
          '2026-09-01T11:00:00',
          'Kontakt F111111'
        ),
        // Logged under the person code, converted since.
        logRow(
          '_LOG0000003    ',
          k444,
          '2026-09-01T12:00:00',
          'Kontakt P000444'
        ),
        // A row whose key resolves to nothing: only the text is left to go on.
        logRow(
          '_LOG0000004    ',
          null,
          '2026-09-01T13:00:00',
          'Kontakt P000555'
        ),
        // Older than every `since` used below.
        logRow(
          '_LOG0000005    ',
          f111,
          '2020-01-01T00:00:00',
          'Kontakt F111111'
        ),
        // Logged against another table. Its key happens to equal a contact
        // key, but keys are only meaningful together with their table, so
        // the text must win here.
        logRow(
          '_LOG0000006    ',
          p333,
          '2026-09-01T14:00:00',
          'Kontakt F111111',
          OTHER_TABLE_KEY
        ),
      ].join('\n')
    )
    await pool.close()

    await testApp.start()
    httpClient = testApp.makeClient()
  })

  afterAll(async () => {
    if (testApp) {
      await testApp.stop()
      testApp = undefined
    }
  })

  const codesSince = async (since: string) => {
    const response = await httpClient.get('/contacts/sync', {
      params: { since },
    })
    expect(response.status).toBe(200)
    return (
      response.data.content.contacts as {
        contact: { contactCode: string }
        timestamp: string
      }[]
    ).map((c) => c.contact.contactCode)
  }

  /**
   * The regression this guards: with the code read from the log text, the
   * first row would look up P000332 and find nothing, so a contact created
   * through Xpand's SOAP service would never be synced.
   */
  it('resolves a contact through the log row key, not the text', async () => {
    expect(await codesSince('2026-09-01T09:00:00Z')).toContain('P000333')
  })

  it('returns a converted contact under its current code', async () => {
    const codes = await codesSince('2026-09-01T09:00:00Z')

    expect(codes).toContain('K000444')
    expect(codes).not.toContain('P000444')
  })

  it('falls back to the text when the key resolves to nothing', async () => {
    expect(await codesSince('2026-09-01T09:00:00Z')).toContain('P000555')
  })

  /**
   * The join is restricted to log rows written against the contact table. A
   * row from another table is resolved from its text, as before this change,
   * even when its key collides with a contact key.
   */
  it('ignores the key of a row logged against another table', async () => {
    const codes = await codesSince('2026-09-01T13:30:00Z')

    expect(codes).toEqual(['F111111'])
  })

  it('returns rows in log order and honours since', async () => {
    // F111111 appears once, at its latest log time, since codes are
    // de-duplicated on the newest entry.
    expect(await codesSince('2026-09-01T09:00:00Z')).toEqual([
      'P000333',
      'K000444',
      'P000555',
      'F111111',
    ])
    expect(await codesSince('2026-09-01T11:30:00Z')).toEqual([
      'K000444',
      'P000555',
      'F111111',
    ])
  })
})
