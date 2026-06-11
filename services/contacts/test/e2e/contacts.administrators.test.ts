import { AxiosInstance } from 'axios'
import { RelatedContactSchema } from '@src/services/contacts-service/schema'
import { makeTestAppFixture, TestApp } from './app-fixture'
import { FULL_TEST_DATA_SET } from './data-set'

describe('förvaltare endpoints', () => {
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

  describe('GET /contacts/:contactCode/administrators', () => {
    it('returns the förvaltare of a contact that has one', async () => {
      const response = await httpClient.get('/contacts/P000555/administrators')

      expect(response.status).toBe(200)
      expect(response.data.content.relations).toHaveLength(1)

      const [relation] = response.data.content.relations
      expect(RelatedContactSchema.safeParse(relation).success).toBe(true)
      expect(relation).toMatchObject({
        contactCode: 'P000444',
        role: 'administrator',
        fullName: 'McTestface Testy',
      })
    })

    it('returns an empty list for a contact without förvaltare', async () => {
      const response = await httpClient.get('/contacts/P000111/administrators')

      expect(response.status).toBe(200)
      expect(response.data.content.relations).toEqual([])
    })

    it('does not return a god man as förvaltare', async () => {
      const response = await httpClient.get('/contacts/P000666/administrators')

      expect(response.status).toBe(200)
      expect(response.data.content.relations).toEqual([])
    })

    it('redacts the name of a förvaltare with a protected identity', async () => {
      const response = await httpClient.get('/contacts/P000777/administrators')

      expect(response.status).toBe(200)
      expect(response.data.content.relations).toHaveLength(1)
      expect(response.data.content.relations[0]).toMatchObject({
        contactCode: 'P000888',
        role: 'administrator',
        fullName: 'redacted',
      })
    })

    it('returns 404 for an unknown contact', async () => {
      const response = await httpClient.get('/contacts/P999999/administrators', {
        validateStatus: () => true,
      })

      expect(response.status).toBe(404)
    })
  })

  describe('GET /contacts/:contactCode/administrator-for', () => {
    it('returns the wards of a förvaltare with role ward, excluding god man wards', async () => {
      const response = await httpClient.get(
        '/contacts/P000444/administrator-for'
      )

      expect(response.status).toBe(200)
      expect(response.data.content.relations).toHaveLength(1)

      const [relation] = response.data.content.relations
      expect(RelatedContactSchema.safeParse(relation).success).toBe(true)
      expect(relation).toMatchObject({
        contactCode: 'P000555',
        role: 'ward',
        fullName: 'Personsson Fiktiv',
      })
    })

    it('returns an empty list for a contact that is not a förvaltare', async () => {
      const response = await httpClient.get(
        '/contacts/P000111/administrator-for'
      )

      expect(response.status).toBe(200)
      expect(response.data.content.relations).toEqual([])
    })

    it('redacts the name of a ward with a protected identity', async () => {
      const response = await httpClient.get(
        '/contacts/P000777/administrator-for'
      )

      expect(response.status).toBe(200)
      expect(response.data.content.relations).toHaveLength(1)
      expect(response.data.content.relations[0]).toMatchObject({
        contactCode: 'P000999',
        role: 'ward',
        fullName: 'redacted',
      })
    })

    it('returns 404 for an unknown contact', async () => {
      const response = await httpClient.get(
        '/contacts/P999999/administrator-for',
        { validateStatus: () => true }
      )

      expect(response.status).toBe(404)
    })
  })

  describe('GET /contacts/:contactCode (relatedContacts bake-in)', () => {
    it('includes the administrator on the ward contact', async () => {
      const response = await httpClient.get('/contacts/P000555')
      expect(response.status).toBe(200)
      expect(response.data.content.relatedContacts).toEqual([
        { contactCode: 'P000444', role: 'administrator', fullName: 'McTestface Testy' },
      ])
    })

    it('includes the ward on the administrator contact', async () => {
      const response = await httpClient.get('/contacts/P000444')
      expect(response.status).toBe(200)
      expect(response.data.content.relatedContacts).toContainEqual({
        contactCode: 'P000555',
        role: 'ward',
        fullName: 'Personsson Fiktiv',
      })
    })

    it('is empty for a contact with no guardian relations', async () => {
      const response = await httpClient.get('/contacts/P000333')
      expect(response.status).toBe(200)
      expect(response.data.content.relatedContacts).toEqual([])
    })

    it('includes the god man with role trustee on the ward contact', async () => {
      const response = await httpClient.get('/contacts/P000666')
      expect(response.status).toBe(200)
      expect(response.data.content.relatedContacts).toEqual([
        { contactCode: 'P000444', role: 'trustee', fullName: 'McTestface Testy' },
      ])
    })

    it('redacts protected-identity names in both relation directions', async () => {
      const response = await httpClient.get('/contacts/P000777')
      expect(response.status).toBe(200)
      expect(response.data.content.relatedContacts).toContainEqual({
        contactCode: 'P000888',
        role: 'administrator',
        fullName: 'redacted',
      })
      expect(response.data.content.relatedContacts).toContainEqual({
        contactCode: 'P000999',
        role: 'ward',
        fullName: 'redacted',
      })
    })
  })
})
