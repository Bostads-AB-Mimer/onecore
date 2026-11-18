import { AxiosInstance } from 'axios'
import { makeTestAppFixture, TestApp } from './app-fixture'
import { FULL_TEST_DATA_SET, LOGIN_CONTACT_DATA_SET } from './data-set'

// The login contact fixtures at the end of seed.sql, with their Sökande roles.
describe('GET /contacts/by-nid/:nid/person-contacts', () => {
  let testApp: TestApp | undefined
  let httpClient: AxiosInstance

  beforeAll(async () => {
    testApp = await makeTestAppFixture({
      dataSet: [...FULL_TEST_DATA_SET, ...LOGIN_CONTACT_DATA_SET],
    })
    await testApp.start()
    httpClient = testApp.makeClient()
  })

  afterAll(async () => {
    if (testApp) {
      await testApp.stop()
      testApp = undefined
    }
  })

  const personContacts = (nid: string) =>
    httpClient.get(`/contacts/by-nid/${nid}/person-contacts`, {
      validateStatus: () => true,
    })

  const contactsFor = async (nid: string) => {
    const response = await personContacts(nid)
    expect(response.status).toBe(200)
    return response.data.content.contacts
  }

  it('lists the login contact first, even when only a later one is active', async () => {
    expect(await contactsFor('195001019800')).toEqual([
      { contactCode: 'P920001', isActive: false },
      { contactCode: 'P920002', isActive: true },
    ])
  })

  it('lists a supplier-only contact last and never active', async () => {
    expect(await contactsFor('196002029814')).toEqual([
      { contactCode: 'P920003', isActive: true },
      { contactCode: 'P920004', isActive: false },
    ])
  })

  it('counts a Sökande role that is not in use as inactive', async () => {
    expect(await contactsFor('197707079872')).toEqual([
      { contactCode: 'P920014', isActive: false },
      { contactCode: 'P920015', isActive: false },
    ])
  })

  it("leaves out the sole trader's company contact", async () => {
    expect(await contactsFor('197003039828')).toEqual([
      { contactCode: 'P920006', isActive: true },
    ])
  })

  it('leaves out deleted contacts', async () => {
    expect(await contactsFor('195512129858')).toEqual([
      { contactCode: 'P920011', isActive: true },
    ])
  })

  it('finds a contact stored in the ten-digit form, in any notation', async () => {
    const expected = [{ contactCode: 'P920009', isActive: false }]
    expect(await contactsFor('199005059846')).toEqual(expected)
    expect(await contactsFor('900505-9846')).toEqual(expected)
  })

  it('answers 200 with an empty list for a personnummer without contacts', async () => {
    expect(await contactsFor('199007292387')).toEqual([])
  })

  it('answers 400 invalid-national-id for a number that is not a personnummer', async () => {
    const response = await personContacts('199007292388')

    expect(response.status).toBe(400)
    expect(response.data.error).toBe('invalid-national-id')
  })
})
