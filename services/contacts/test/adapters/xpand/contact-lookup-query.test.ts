import { Knex } from 'knex'
import config from '@src/common/config'
import { xpandDbClient } from '@src/adapters/xpand/db'
import {
  canonicalContactCode,
  contactExists,
  contactNamesByCodes,
} from '@src/adapters/xpand/contact-lookup-query'
import { connect, prepareDataSet } from '../../e2e/app-fixture'
import { FULL_TEST_DATA_SET } from '../../e2e/data-set'

const xpandResource = xpandDbClient(config.xpandDatabase)
let xpand: Knex

beforeAll(async () => {
  const pool = await connect()
  await prepareDataSet(pool, FULL_TEST_DATA_SET)
  await pool.close()
  await xpandResource.init()
  xpand = xpandResource.get()
})

afterAll(async () => {
  await xpandResource.close()
})

describe('contactExists', () => {
  it('is true for a seeded contact and false for an unknown one', async () => {
    expect(await contactExists(xpand, 'P000444')).toBe(true)
    expect(await contactExists(xpand, 'P999999')).toBe(false)
    expect(await contactExists(xpand, '   ')).toBe(false)
  })
})

describe('canonicalContactCode', () => {
  // Xpand collates case-insensitively, so it answers a lowercase lookup — but
  // the read path keys names by the code Xpand returns. Writers persist this
  // form so a relation cannot be stored in a casing the kundkort then drops.
  it('answers with the code as Xpand spells it', async () => {
    expect(await canonicalContactCode(xpand, 'p000444')).toBe('P000444')
    expect(await canonicalContactCode(xpand, ' P000444 ')).toBe('P000444')
  })

  it('is null for an unknown or blank code', async () => {
    expect(await canonicalContactCode(xpand, 'P999999')).toBeNull()
    expect(await canonicalContactCode(xpand, '   ')).toBeNull()
  })
})

describe('contactNamesByCodes', () => {
  it('returns trimmed names keyed by contact code', async () => {
    const names = await contactNamesByCodes(xpand, ['P000444', 'P000555'])

    expect(names.get('P000444')).toEqual({
      fullName: 'McTestface Testy',
      firstName: 'Testy',
      lastName: 'McTestface',
    })
    expect(names.get('P000555')).toEqual({
      fullName: 'Personsson Fiktiv',
      firstName: 'Fiktiv',
      lastName: 'Personsson',
    })
  })

  it('redacts every name field for a protected identity', async () => {
    const names = await contactNamesByCodes(xpand, ['P000888'])
    expect(names.get('P000888')).toEqual({
      fullName: 'redacted',
      firstName: 'redacted',
      lastName: 'redacted',
    })
  })

  it('omits unknown codes and returns an empty map for no codes', async () => {
    const names = await contactNamesByCodes(xpand, ['P000444', 'P999999'])
    expect([...names.keys()]).toEqual(['P000444'])
    expect((await contactNamesByCodes(xpand, [])).size).toBe(0)
  })

  it('trims requested codes', async () => {
    const names = await contactNamesByCodes(xpand, [' P000444 '])
    expect(names.get('P000444')?.firstName).toBe('Testy')
  })

  it('dedupes and chunks a long code list', async () => {
    // P000555 is appended last so, after dedupe, it lands in the second
    // chunk: proves results are merged across chunks, not just the first.
    const codes = [
      ...Array.from({ length: 2500 }, (_, i) =>
        i % 2 === 0 ? 'P000444' : `X${String(i).padStart(6, '0')}`
      ),
      'P000555',
    ]
    const names = await contactNamesByCodes(xpand, codes)
    expect([...names.keys()].sort()).toEqual(['P000444', 'P000555'])
  })
})
