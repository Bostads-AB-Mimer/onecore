import { Knex } from 'knex'
import config from '@src/common/config'
import { xpandDbClient } from '@src/adapters/xpand/db'
import { xpandContactCategoryWriter } from '@src/adapters/xpand/convert-contact'
import { xpandContactsRepository } from '@src/adapters/xpand/repository'
import { ContactCategory } from '@src/domain/contact'
import { requireXpandTestDb } from '../../db-support'
import { connect, prepareDataSet } from '../../e2e/app-fixture'
import { FULL_TEST_DATA_SET } from '../../e2e/data-set'

requireXpandTestDb()

const xpandResource = xpandDbClient(config.xpandDatabase)
let xpand: Knex

const writer = xpandContactCategoryWriter(xpandResource)
const repository = xpandContactsRepository(xpandResource)

const rawRow = (contactCode: string) =>
  xpand('cmctc')
    .select('cmctckod', 'keycmctk', 'cmctcben', 'fnamn', 'enamn', 'birthdate')
    .where('cmctckod', contactCode)
    .first()

beforeAll(async () => {
  const pool = await connect()
  await prepareDataSet(pool, FULL_TEST_DATA_SET)
  // Give the person a stored identity number and a birth date so the test can
  // show what the conversion keeps and what it clears.
  await pool.request().query(`
    UPDATE cmctc
    SET persorgnr = '5560160680', birthdate = '1990-07-29'
    WHERE cmctckod = 'P000333'
  `)
  await pool.close()
  await xpandResource.init()
  xpand = xpandResource.get()
})

afterAll(async () => {
  await xpandResource.close()
})

describe('xpandContactCategoryWriter.convertToOrganisation', () => {
  it('re-prefixes the code, sets the category and clears the person fields', async () => {
    const result = await writer.convertToOrganisation({
      contactCode: 'P000333',
      category: 'F',
      name: 'Testbolag Ett AB',
    })

    expect(result).toEqual({ ok: true, data: { contactCode: 'F000333' } })

    const row = await rawRow('F000333')
    expect(row).toMatchObject({
      cmctckod: 'F000333',
      cmctcben: 'Testbolag Ett AB',
      fnamn: null,
      enamn: null,
      birthdate: null,
    })
    expect(row.keycmctk.trim()).toBe('_0EI00000F')
    expect(await rawRow('P000333')).toBeUndefined()
  })

  /**
   * The read side derives the contact type from the code prefix, so the
   * conversion is only complete if the contact now reads as an organisation.
   */
  it('reads back as an organisation with the stored number and name', async () => {
    const contact = await repository.getByContactCode('F000333')

    expect(contact).toMatchObject({
      type: 'organisation',
      contactCode: 'F000333',
      organisation: {
        organisationNumber: '5560160680',
        name: 'Testbolag Ett AB',
      },
    })
  })

  /**
   * Retries after an ambiguous failure must be safe: the second run finds the
   * person code gone and the converted code present, and changes nothing.
   */
  it('reports an already converted contact without touching it', async () => {
    const before = await rawRow('F000333')

    const result = await writer.convertToOrganisation({
      contactCode: 'P000333',
      category: 'F',
      name: 'Ett Annat Namn AB',
    })

    expect(result).toEqual({
      ok: false,
      err: 'already-converted',
      detail: 'F000333',
    })
    expect(await rawRow('F000333')).toEqual(before)
  })

  it('uses the latin-O key for category Ö', async () => {
    const result = await writer.convertToOrganisation({
      contactCode: 'P000222',
      category: 'Ö',
      name: 'Övriga Föreningen',
    })

    expect(result).toEqual({ ok: true, data: { contactCode: 'Ö000222' } })

    const row = await rawRow('Ö000222')
    expect(row.keycmctk.trim()).toBe('_0EI00000O')
    expect(row.cmctcben).toBe('Övriga Föreningen')
  })

  it('reports an unknown person code', async () => {
    expect(
      await writer.convertToOrganisation({
        contactCode: 'P999999',
        category: 'K',
        name: 'Ingen Kommun',
      })
    ).toEqual({ ok: false, err: 'contact-not-found', detail: 'P999999' })
  })

  it('refuses a code outside the P series', async () => {
    expect(
      await writer.convertToOrganisation({
        contactCode: 'F111111',
        category: 'K',
        name: 'Redan Företag AB',
      })
    ).toEqual({ ok: false, err: 'contact-not-found', detail: 'F111111' })

    expect(await rawRow('F111111')).toBeDefined()
  })

  it('refuses a category without a verified key, before touching the database', async () => {
    const before = await rawRow('P000111')

    expect(
      await writer.convertToOrganisation({
        contactCode: 'P000111',
        category: 'X' as ContactCategory,
        name: 'Okänd Kategori',
      })
    ).toEqual({ ok: false, err: 'unsupported-category', detail: 'X' })

    expect(await rawRow('P000111')).toEqual(before)
  })
})
