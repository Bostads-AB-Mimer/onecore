import { AxiosInstance } from 'axios'
import { makeTestAppFixture, TestApp } from './app-fixture'
import { FULL_TEST_DATA_SET } from './data-set'
import { ContactSchema } from '@src/services/contacts-service/schema'

describe('/contacts/batch', () => {
  let testApp: TestApp | undefined
  let httpClient: AxiosInstance

  beforeAll(async () => {
    testApp = await makeTestAppFixture({
      dataSet: FULL_TEST_DATA_SET,
    })
    await testApp.start()
    httpClient = testApp.makeClient()
    // Match the repeated-key serialization the route expects (Koa's default
    // querystring parser doesn't unpack `?code[]=A&code[]=B` into an array).
    httpClient.defaults.paramsSerializer = { indexes: null }
  })

  afterAll(async () => {
    if (testApp) {
      await testApp.stop()
      testApp = undefined
    }
  })

  describe('Lean default', () => {
    it('returns base contact fields with empty phone/email/address arrays', async () => {
      const response = await httpClient.get('/contacts/batch', {
        params: { code: ['P000333', 'P000111'] },
      })

      expect(response.status).toBe(200)
      expect(response.data.content.contacts).toHaveLength(2)

      for (const contact of response.data.content.contacts) {
        const parsed = ContactSchema.safeParse(contact)
        expect(parsed.success).toBe(true)
        expect(contact.communication.phoneNumbers).toEqual([])
        expect(contact.communication.emailAddresses).toEqual([])
        expect(contact.addresses).toEqual([])
      }

      const codes = response.data.content.contacts
        .map((c: { contactCode: string }) => c.contactCode)
        .sort()
      expect(codes).toEqual(['P000111', 'P000333'])
    })

    it('omits missing codes from the response (no error)', async () => {
      const response = await httpClient.get('/contacts/batch', {
        params: { code: ['P000333', 'P999999-does-not-exist'] },
      })

      expect(response.status).toBe(200)
      expect(response.data.content.contacts).toHaveLength(1)
      expect(response.data.content.contacts[0].contactCode).toBe('P000333')
    })

    it('handles a single code passed as a non-array', async () => {
      const response = await httpClient.get('/contacts/batch', {
        params: { code: 'P000333' },
      })

      expect(response.status).toBe(200)
      expect(response.data.content.contacts).toHaveLength(1)
      expect(response.data.content.contacts[0].contactCode).toBe('P000333')
    })
  })

  describe('Include flags', () => {
    it('includePhone=true populates phoneNumbers but leaves email/address empty', async () => {
      const response = await httpClient.get('/contacts/batch', {
        params: { code: ['P000333'], includePhone: true },
      })

      expect(response.status).toBe(200)
      const contact = response.data.content.contacts[0]
      expect(contact.communication.phoneNumbers.length).toBeGreaterThan(0)
      expect(contact.communication.emailAddresses).toEqual([])
      expect(contact.addresses).toEqual([])
    })

    it('all three include flags populate all three', async () => {
      const response = await httpClient.get('/contacts/batch', {
        params: {
          code: ['P000333'],
          includePhone: true,
          includeEmail: true,
          includeAddress: true,
        },
      })

      expect(response.status).toBe(200)
      const contact = response.data.content.contacts[0]
      expect(contact.communication.phoneNumbers.length).toBeGreaterThan(0)
      expect(contact.addresses.length).toBeGreaterThan(0)
      // P000333 has no email per the byContactCode test fixture, but the
      // shape must still be a valid array.
      expect(Array.isArray(contact.communication.emailAddresses)).toBe(true)
    })
  })

  describe('Input validation', () => {
    it('returns 400 when no code param is provided', async () => {
      const response = await httpClient.get('/contacts/batch', {
        validateStatus: () => true,
      })
      expect(response.status).toBe(400)
    })
  })
})
