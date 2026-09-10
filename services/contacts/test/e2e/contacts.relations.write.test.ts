import { AxiosInstance } from 'axios'
import { makeTestAppFixture, TestApp } from './app-fixture'
import { FULL_TEST_DATA_SET } from './data-set'

describe('relation write endpoints', () => {
  let testApp: TestApp | undefined
  let httpClient: AxiosInstance

  beforeAll(async () => {
    testApp = await makeTestAppFixture({ dataSet: FULL_TEST_DATA_SET })
    await testApp.start()
    httpClient = testApp.makeClient()
  })

  afterAll(async () => {
    await testApp?.stop()
    testApp = undefined
  })

  const post = (contactCode: string, body: unknown) =>
    httpClient.post(`/contacts/${contactCode}/relations`, body, {
      validateStatus: () => true,
    })

  const del = (
    contactCode: string,
    roleType: string,
    relatedContactCode: string,
    deletedBy = 'handläggare'
  ) =>
    httpClient.delete(
      `/contacts/${contactCode}/relations/${roleType}/${relatedContactCode}`,
      { params: { deletedBy }, validateStatus: () => true }
    )

  describe('POST /contacts/:contactCode/relations', () => {
    it('creates a god man and returns the subject relations; both kundkort see it', async () => {
      const response = await post('P000111', {
        relatedContactCode: 'P000222',
        roleType: 'god_man',
        createdBy: 'handläggare',
      })

      expect(response.status).toBe(201)
      expect(response.data.content.relations).toEqual([
        expect.objectContaining({ contactCode: 'P000222', role: 'trustee' }),
      ])

      const guardian = await httpClient.get('/contacts/P000222')
      expect(guardian.data.content.relatedContacts).toEqual([
        expect.objectContaining({ contactCode: 'P000111', role: 'trusteeFor' }),
      ])

      const rows = await testApp!
        .contactsDb()('contact_relation')
        .where({ subject_contact_code: 'P000111' })
      expect(rows[0]).toMatchObject({
        created_by: 'handläggare',
        deleted_at: null,
      })
    })

    it('rejects a second guardian with 409 and names the existing one', async () => {
      // P000555 already has förvaltare P000444 from the fixture.
      const response = await post('P000555', {
        relatedContactCode: 'P000222',
        roleType: 'god_man',
        createdBy: 'handläggare',
      })

      expect(response.status).toBe(409)
      expect(response.data).toMatchObject({
        error: 'guardian-exists',
        detail: 'P000444',
      })
    })

    it('rejects the same edge twice with 409', async () => {
      const response = await post('P000555', {
        relatedContactCode: 'P000444',
        roleType: 'forvaltare',
        createdBy: 'handläggare',
      })

      expect(response.status).toBe(409)
      expect(response.data).toMatchObject({ error: 'duplicate-relation' })
    })

    it('rejects a self-relation with 422', async () => {
      const response = await post('P000333', {
        relatedContactCode: 'P000333',
        roleType: 'god_man',
        createdBy: 'handläggare',
      })
      expect(response.status).toBe(422)
      expect(response.data).toMatchObject({ error: 'self-relation' })
    })

    it('returns 404 when the subject or the related contact does not exist', async () => {
      const subject = await post('P999999', {
        relatedContactCode: 'P000222',
        roleType: 'god_man',
        createdBy: 'handläggare',
      })
      expect(subject.status).toBe(404)
      expect(subject.data).toMatchObject({ error: 'subject-not-found' })

      const related = await post('P000333', {
        relatedContactCode: 'P999999',
        roleType: 'god_man',
        createdBy: 'handläggare',
      })
      expect(related.status).toBe(404)
      expect(related.data).toMatchObject({ error: 'related-not-found' })
    })

    it('returns 400 for an invalid body', async () => {
      const response = await post('P000333', { relatedContactCode: 'P000222' })
      expect(response.status).toBe(400)
      expect(response.data.error).toBe('invalid-request-body')
    })
  })

  describe('DELETE /contacts/:contactCode/relations/:roleType/:relatedContactCode', () => {
    it('soft-deletes the relation and returns 204; a second delete is 404', async () => {
      await post('P001000', {
        relatedContactCode: 'P000222',
        roleType: 'forvaltare',
        createdBy: 'handläggare',
      })

      const response = await del(
        'P001000',
        'forvaltare',
        'P000222',
        'borttagare'
      )
      expect(response.status).toBe(204)

      const rows = await testApp!
        .contactsDb()('contact_relation')
        .where({ subject_contact_code: 'P001000' })
      expect(rows).toHaveLength(1)
      expect(rows[0].deleted_at).toEqual(expect.any(Date))
      expect(rows[0].deleted_by).toBe('borttagare')

      const subject = await httpClient.get('/contacts/P001000')
      expect(subject.data.content.relatedContacts).toEqual([])

      const again = await del('P001000', 'forvaltare', 'P000222')
      expect(again.status).toBe(404)
      expect(again.data).toMatchObject({ error: 'relation-not-found' })
    })

    it('returns 400 for an unknown role type or a missing deletedBy', async () => {
      const role = await del('P000555', 'nyttjare', 'P000444')
      expect(role.status).toBe(400)
      expect(role.data).toMatchObject({ error: 'invalid-role-type' })

      const actor = await httpClient.delete(
        '/contacts/P000555/relations/forvaltare/P000444',
        { validateStatus: () => true }
      )
      expect(actor.status).toBe(400)
      expect(actor.data).toMatchObject({ error: 'missing-deleted-by' })
    })
  })
})
