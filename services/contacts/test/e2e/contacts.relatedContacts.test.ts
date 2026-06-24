import { AxiosInstance } from 'axios'
import { RelatedContactSchema } from '@src/services/contacts-service/schema'
import { makeTestAppFixture, TestApp } from './app-fixture'
import { FULL_TEST_DATA_SET } from './data-set'

describe('relatedContacts endpoints', () => {
  let testApp: TestApp | undefined
  let httpClient: AxiosInstance

  beforeAll(async () => {
    testApp = await makeTestAppFixture({
      dataSet: [
        ...FULL_TEST_DATA_SET,
        'P900001',
        'P900002',
        'P900003',
        'P900004',
        'P900010',
        'P900011',
        'P900012',
      ],
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

  describe('GET /contacts/:contactCode/administrator', () => {
    it('returns the administrator as a full contact', async () => {
      const response = await httpClient.get('/contacts/P000555/administrator')

      expect(response.status).toBe(200)
      expect(response.data.content).toMatchObject({
        contactCode: 'P000444',
      })
    })

    it('returns 404 when the contact has only a god man (no administrator)', async () => {
      const response = await httpClient.get('/contacts/P000666/administrator', {
        validateStatus: () => true,
      })

      expect(response.status).toBe(404)
    })

    it('returns 404 for a contact without an administrator', async () => {
      const response = await httpClient.get('/contacts/P000111/administrator', {
        validateStatus: () => true,
      })

      expect(response.status).toBe(404)
    })
  })

  describe('GET /contacts/:contactCode/administrator-for', () => {
    it('returns the contacts a förvaltare administers (role administratorFor), excluding god man relations', async () => {
      const response = await httpClient.get(
        '/contacts/P000444/administrator-for'
      )

      expect(response.status).toBe(200)
      expect(response.data.content.relations).toHaveLength(1)

      const [relation] = response.data.content.relations
      expect(RelatedContactSchema.safeParse(relation).success).toBe(true)
      expect(relation).toMatchObject({
        contactCode: 'P000555',
        role: 'administratorFor',
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

    it('redacts the name of an administratorFor relation with a protected identity', async () => {
      const response = await httpClient.get(
        '/contacts/P000777/administrator-for'
      )

      expect(response.status).toBe(200)
      expect(response.data.content.relations).toHaveLength(1)
      expect(response.data.content.relations[0]).toMatchObject({
        contactCode: 'P000999',
        role: 'administratorFor',
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
    it('returns the contacts a trustee is god man for (role trusteeFor), excluding förvaltare relations', async () => {
      const response = await httpClient.get('/contacts/P000444/trustee-for')

      expect(response.status).toBe(200)
      expect(response.data.content.relations).toHaveLength(1)

      const [relation] = response.data.content.relations
      expect(RelatedContactSchema.safeParse(relation).success).toBe(true)
      expect(relation).toMatchObject({
        contactCode: 'P000666',
        role: 'trusteeFor',
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

  describe('GET /contacts/:contactCode/other-invoice-recipients', () => {
    it('returns the recipient on an active lease, deduped across leases', async () => {
      const response = await httpClient.get(
        '/contacts/P900001/other-invoice-recipients'
      )

      expect(response.status).toBe(200)
      expect(response.data.content.relations).toHaveLength(1)
      const [relation] = response.data.content.relations
      expect(RelatedContactSchema.safeParse(relation).success).toBe(true)
      expect(relation).toMatchObject({
        contactCode: 'P900010',
        role: 'otherInvoiceRecipient',
      })
    })

    it('redacts a recipient with a protected identity', async () => {
      const response = await httpClient.get(
        '/contacts/P900004/other-invoice-recipients'
      )

      expect(response.status).toBe(200)
      expect(response.data.content.relations).toHaveLength(1)
      expect(response.data.content.relations[0]).toMatchObject({
        contactCode: 'P000888',
        role: 'otherInvoiceRecipient',
        fullName: 'redacted',
      })
    })

    it('excludes recipients on terminated leases', async () => {
      const response = await httpClient.get(
        '/contacts/P900002/other-invoice-recipients'
      )
      expect(response.status).toBe(200)
      expect(response.data.content.relations).toEqual([])
    })

    it('excludes expired ANNANFM relations', async () => {
      const response = await httpClient.get(
        '/contacts/P900003/other-invoice-recipients'
      )
      expect(response.status).toBe(200)
      expect(response.data.content.relations).toEqual([])
    })

    it('returns 404 for an unknown contact', async () => {
      const response = await httpClient.get(
        '/contacts/P999999/other-invoice-recipients',
        { validateStatus: () => true }
      )
      expect(response.status).toBe(404)
    })
  })

  describe('GET /contacts/:contactCode/other-invoice-recipient-for', () => {
    it('returns the holders a contact is recipient for, current-only and deduped', async () => {
      const response = await httpClient.get(
        '/contacts/P900010/other-invoice-recipient-for'
      )
      expect(response.status).toBe(200)
      expect(response.data.content.relations).toHaveLength(1)
      const [relation] = response.data.content.relations
      expect(relation).toMatchObject({
        contactCode: 'P900001',
        role: 'otherInvoiceRecipientFor',
      })
    })

    it('excludes holders on terminated leases', async () => {
      const response = await httpClient.get(
        '/contacts/P900011/other-invoice-recipient-for'
      )

      expect(response.status).toBe(200)
      expect(response.data.content.relations).toEqual([])
    })

    it('excludes expired ANNANFM relations', async () => {
      const response = await httpClient.get(
        '/contacts/P900012/other-invoice-recipient-for'
      )

      expect(response.status).toBe(200)
      expect(response.data.content.relations).toEqual([])
    })

    it('returns an empty list for a contact that is recipient for no one', async () => {
      const response = await httpClient.get(
        '/contacts/P000111/other-invoice-recipient-for'
      )

      expect(response.status).toBe(200)
      expect(response.data.content.relations).toEqual([])
    })

    it('returns 404 for an unknown contact', async () => {
      const response = await httpClient.get(
        '/contacts/P999999/other-invoice-recipient-for',
        { validateStatus: () => true }
      )

      expect(response.status).toBe(404)
    })
  })

  describe('GET /contacts/:contactCode (relatedContacts bake-in)', () => {
    it('includes the administrator on the represented contact', async () => {
      const response = await httpClient.get('/contacts/P000555')
      expect(response.status).toBe(200)
      expect(response.data.content.relatedContacts).toEqual([
        {
          contactCode: 'P000444',
          role: 'administrator',
          fullName: 'McTestface Testy',
        },
      ])
    })

    it('includes the administratorFor relation on the administrator contact', async () => {
      const response = await httpClient.get('/contacts/P000444')
      expect(response.status).toBe(200)
      expect(response.data.content.relatedContacts).toContainEqual({
        contactCode: 'P000555',
        role: 'administratorFor',
        fullName: 'Personsson Fiktiv',
      })
    })

    it('is an empty array for an organisation with no relations', async () => {
      const response = await httpClient.get('/contacts/F111111')
      expect(response.status).toBe(200)
      expect(response.data.content.type).toBe('organisation')
      expect(response.data.content.relatedContacts).toEqual([])
    })

    it('includes the god man with role trustee on the represented contact', async () => {
      const response = await httpClient.get('/contacts/P000666')
      expect(response.status).toBe(200)
      expect(response.data.content.relatedContacts).toEqual([
        {
          contactCode: 'P000444',
          role: 'trustee',
          fullName: 'McTestface Testy',
        },
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
        role: 'administratorFor',
        fullName: 'redacted',
      })
    })

    it('includes the otherInvoiceRecipient on the holder contact', async () => {
      const response = await httpClient.get('/contacts/P900001')
      expect(response.status).toBe(200)
      expect(response.data.content.relatedContacts).toContainEqual({
        contactCode: 'P900010',
        role: 'otherInvoiceRecipient',
        fullName: expect.any(String),
      })
    })

    it('includes the otherInvoiceRecipientFor on the recipient contact', async () => {
      const response = await httpClient.get('/contacts/P900010')
      expect(response.status).toBe(200)
      expect(response.data.content.relatedContacts).toContainEqual({
        contactCode: 'P900001',
        role: 'otherInvoiceRecipientFor',
        fullName: expect.any(String),
      })
    })
  })
})
