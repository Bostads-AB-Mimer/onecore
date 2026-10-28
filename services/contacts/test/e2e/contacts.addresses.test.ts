import { AxiosInstance } from 'axios'
import { makeTestAppFixture, TestApp } from './app-fixture'
import { FULL_TEST_DATA_SET } from './data-set'

/**
 * Only the fakturaadress (`cmadr.keycmtyp = 'adrfakt'`) is a contact address
 * as far as this service is concerned.
 */
describe('contact addresses', () => {
  let testApp: TestApp | undefined
  let httpClient: AxiosInstance

  beforeAll(async () => {
    testApp = await makeTestAppFixture({ dataSet: FULL_TEST_DATA_SET })
    await testApp.start()
    httpClient = testApp.makeClient()
    httpClient.defaults.paramsSerializer = { indexes: null }
  })

  afterAll(async () => {
    if (testApp) {
      await testApp.stop()
      testApp = undefined
    }
  })

  // P000222 has a current adrpost (Finnsintegatan 1 A) and adrfakt
  // (Ingentingstigen 27) at different addresses.
  describe('GET /contacts/:contactCode', () => {
    it('returns the fakturaadress and not the postadress', async () => {
      const response = await httpClient.get('/contacts/P000222')

      expect(response.status).toBe(200)
      expect(response.data.content.addresses).toEqual([
        expect.objectContaining({ street: 'Ingentingstigen 27' }),
      ])
    })

    it('excludes a fakturaadress that has not taken effect yet', async () => {
      const response = await httpClient.get('/contacts/P000777')

      expect(response.status).toBe(200)
      expect(response.data.content.addresses).toHaveLength(1)
      expect(response.data.content.addresses[0].full).not.toContain(
        'Framtidsvägen'
      )
    })

    // P001000 has two open-ended fakturaadresser; the later one is current.
    it('returns only the most recently registered fakturaadress', async () => {
      const response = await httpClient.get('/contacts/P001000')

      expect(response.status).toBe(200)
      expect(response.data.content.addresses).toEqual([
        expect.objectContaining({ street: 'Senaste Flyttgatan 7' }),
      ])
    })
  })

  describe('GET /contacts/batch', () => {
    it('returns the fakturaadress and not the postadress', async () => {
      const response = await httpClient.get('/contacts/batch', {
        params: { code: ['P000222'], includeAddress: true },
      })

      expect(response.status).toBe(200)
      expect(response.data.content.contacts[0].addresses).toEqual([
        expect.objectContaining({ street: 'Ingentingstigen 27' }),
      ])
    })

    it('excludes a fakturaadress that has not taken effect yet', async () => {
      const response = await httpClient.get('/contacts/batch', {
        params: { code: ['P000777'], includeAddress: true },
      })

      expect(response.status).toBe(200)
      const addresses = response.data.content.contacts[0].addresses
      expect(addresses).toHaveLength(1)
      expect(addresses[0].full).not.toContain('Framtidsvägen')
    })

    it('returns only the most recently registered fakturaadress', async () => {
      const response = await httpClient.get('/contacts/batch', {
        params: { code: ['P001000'], includeAddress: true },
      })

      expect(response.status).toBe(200)
      expect(response.data.content.contacts[0].addresses).toEqual([
        expect.objectContaining({ street: 'Senaste Flyttgatan 7' }),
      ])
    })
  })

  describe('address search', () => {
    it('does not match a contact on its postadress', async () => {
      const response = await httpClient.get('/contacts', {
        params: { q: ['Finnsintegatan'] },
      })

      expect(response.status).toBe(200)
      expect(
        response.data.content.map((c: { contactCode: string }) => c.contactCode)
      ).not.toContain('P000222')
    })
  })
})
