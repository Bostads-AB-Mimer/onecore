import { AxiosInstance } from 'axios'
import { makeTestAppFixture, TestApp } from './app-fixture'
import { FULL_TEST_DATA_SET } from './data-set'

// See the login contact fixtures at the end of seed.sql.
const LOGIN_CONTACT_DATA_SET = [
  'P920001',
  'P920002',
  'P920003',
  'P920004',
  'F920005',
  'P920006',
  'P920007',
  'P920008',
  'P920009',
  'P920010',
  'P920011',
  'P920012',
  'P920013',
]

describe('GET /contacts/by-nid/:nid/login-contact', () => {
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

  const loginContactCode = async (nid: string) => {
    const response = await httpClient.get(
      `/contacts/by-nid/${nid}/login-contact`,
      { validateStatus: () => true }
    )
    return response.status === 200
      ? response.data.content.contactCode
      : response.status
  }

  it('picks the tenant over a newer web registration with queue time', async () => {
    expect(await loginContactCode('195001019800')).toBe('P920001')
  })

  it('picks the customer over a newer supplier contact', async () => {
    expect(await loginContactCode('196002029814')).toBe('P920003')
  })

  it("ignores the sole trader's company contact, even with a lease", async () => {
    expect(await loginContactCode('197003039828')).toBe('P920006')
  })

  it('picks the newer of two web registrations', async () => {
    expect(await loginContactCode('198004049832')).toBe('P920008')
  })

  it('finds a contact stored in the ten-digit form with a hyphen', async () => {
    expect(await loginContactCode('199005059846')).toBe('P920009')
  })

  it('accepts the personnummer in any common notation', async () => {
    expect(await loginContactCode('19500101-9800')).toBe('P920001')
    expect(await loginContactCode('5001019800')).toBe('P920001')
  })

  it('ignores a deleted contact, even a tenant', async () => {
    expect(await loginContactCode('195512129858')).toBe('P920011')
  })

  it('does not count an ended lease', async () => {
    expect(await loginContactCode('196611119865')).toBe('P920013')
  })

  it('returns the full contact', async () => {
    const response = await httpClient.get(
      '/contacts/by-nid/195001019800/login-contact'
    )

    expect(response.data.content).toMatchObject({
      contactCode: 'P920001',
      type: 'individual',
    })
  })

  it('is 404 for a personnummer without contacts', async () => {
    expect(await loginContactCode('196408233234')).toBe(404)
  })

  it('is 404 for something that is not a personnummer', async () => {
    expect(await loginContactCode('abc')).toBe(404)
    expect(await loginContactCode('195001019801')).toBe(404)
  })
})
