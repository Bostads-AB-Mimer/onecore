import { AxiosInstance } from 'axios'
import { RelatedContactSchema } from '@src/services/contacts-service/schema'
import { makeTestAppFixture, TestApp } from './app-fixture'
import { FULL_TEST_DATA_SET } from './data-set'

describe('trustee endpoints', () => {
  let testApp: TestApp | undefined
  let httpClient: AxiosInstance

  beforeAll(async () => {
    testApp = await makeTestAppFixture({
      dataSet: FULL_TEST_DATA_SET,
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

  describe('GET /contacts/:contactCode/trustee', () => {
    it('returns the trustee as a full contact', async () => {
      const response = await httpClient.get('/contacts/P000666/trustee')

      expect(response.status).toBe(200)
      expect(response.data.content).toMatchObject({
        contactCode: 'P000444',
      })
    })

    it('returns 404 when the contact has only a förvaltare (no trustee)', async () => {
      const response = await httpClient.get('/contacts/P000555/trustee', {
        validateStatus: () => true,
      })

      expect(response.status).toBe(404)
    })

    it('returns 404 for an unknown contact', async () => {
      const response = await httpClient.get('/contacts/P999999/trustee', {
        validateStatus: () => true,
      })

      expect(response.status).toBe(404)
    })
  })

  describe('GET /contacts/:contactCode/trustee-for', () => {
    it('returns the wards of a trustee with role ward, excluding förvaltare wards', async () => {
      const response = await httpClient.get('/contacts/P000444/trustee-for')

      expect(response.status).toBe(200)
      expect(response.data.content.relations).toHaveLength(1)

      const [relation] = response.data.content.relations
      expect(RelatedContactSchema.safeParse(relation).success).toBe(true)
      expect(relation).toMatchObject({
        contactCode: 'P000666',
        role: 'ward',
        fullName: 'Exempelsdotter Testolina',
      })
    })

    it('returns an empty list for a contact that is trustee for no one', async () => {
      const response = await httpClient.get('/contacts/P000111/trustee-for')

      expect(response.status).toBe(200)
      expect(response.data.content.relations).toEqual([])
    })

    it('returns 404 for an unknown contact', async () => {
      const response = await httpClient.get('/contacts/P999999/trustee-for', {
        validateStatus: () => true,
      })

      expect(response.status).toBe(404)
    })
  })
})
