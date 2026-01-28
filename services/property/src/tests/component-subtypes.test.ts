import request from 'supertest'
import assert from 'node:assert'
import app from '../app'
import { factory } from './factories'

describe('Component Subtypes API', () => {
  let existingTypeId: string
  let existingSubtypeId: string

  beforeAll(async () => {
    // Get an existing type ID for tests
    const typesResponse = await request(app.callback()).get('/component-types')
    if (typesResponse.body.content?.length > 0) {
      existingTypeId = typesResponse.body.content[0].id
    }

    // Get an existing subtype ID for tests
    const subtypesResponse = await request(app.callback()).get(
      '/component-subtypes'
    )
    if (subtypesResponse.body.content?.length > 0) {
      existingSubtypeId = subtypesResponse.body.content[0].id
    }
  })

  describe('GET /component-subtypes', () => {
    it('should return subtypes filtered by typeId', async () => {
      assert(existingTypeId, 'Setup failed: no existing type found')

      const response = await request(app.callback())
        .get('/component-subtypes')
        .query({ typeId: existingTypeId })

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        content: expect.any(Array),
      })

      // All returned subtypes should belong to the specified type
      response.body.content.forEach((subtype: { typeId: string }) => {
        expect(subtype.typeId).toBe(existingTypeId)
      })
    })

    it('should search by subtypeName with 2+ characters', async () => {
      // First get a subtype to know a valid name to search for
      const allResponse = await request(app.callback()).get(
        '/component-subtypes'
      )
      expect(allResponse.status).toBe(200)

      if (allResponse.body.content.length === 0) {
        console.log('No subtypes available to test search')
        return
      }

      // Get first 2 chars of an existing subtype name
      const existingName = allResponse.body.content[0].subTypeName
      const searchTerm = existingName.substring(0, 2)

      const response = await request(app.callback())
        .get('/component-subtypes')
        .query({ subtypeName: searchTerm })

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        content: expect.any(Array),
      })

      // All results should contain the search term (case-insensitive)
      response.body.content.forEach((subtype: { subTypeName: string }) => {
        expect(subtype.subTypeName.toLowerCase()).toContain(
          searchTerm.toLowerCase()
        )
      })
    })

    it('should ignore subtypeName search with < 2 characters (returns all)', async () => {
      // Get total count without filter
      const allResponse = await request(app.callback()).get(
        '/component-subtypes'
      )
      expect(allResponse.status).toBe(200)
      const totalWithoutFilter = allResponse.body.pagination.total

      // Search with single character - should be ignored
      const response = await request(app.callback())
        .get('/component-subtypes')
        .query({ subtypeName: 'a' })

      expect(response.status).toBe(200)
      // Total should be same as without filter (search ignored)
      expect(response.body.pagination.total).toBe(totalWithoutFilter)
    })

    it('should return empty array when filter matches nothing', async () => {
      const nonExistentTypeId = '00000000-0000-0000-0000-000000000000'

      const response = await request(app.callback())
        .get('/component-subtypes')
        .query({ typeId: nonExistentTypeId })

      expect(response.status).toBe(200)
      expect(response.body.content).toEqual([])
    })
  })

  describe('GET /component-subtypes/:id', () => {
    it('should return subtype when it exists', async () => {
      assert(existingSubtypeId, 'Setup failed: no existing subtype found')

      const response = await request(app.callback()).get(
        `/component-subtypes/${existingSubtypeId}`
      )

      expect(response.status).toBe(200)
      expect(response.body.content).toMatchObject({
        id: existingSubtypeId,
        subTypeName: expect.any(String),
        typeId: expect.any(String),
      })
    })

    it('should return 404 for non-existent ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000'
      const response = await request(app.callback()).get(
        `/component-subtypes/${nonExistentId}`
      )

      expect(response.status).toBe(404)
      expect(response.body.error).toMatch(/not found|does not exist/i)
    })

    it('should return 400 for invalid UUID format', async () => {
      const invalidId = 'not-a-valid-uuid'
      const response = await request(app.callback()).get(
        `/component-subtypes/${invalidId}`
      )

      expect(response.status).toBe(400)
    })
  })

  describe('POST /component-subtypes', () => {
    it('should create subtype and persist data correctly', async () => {
      assert(existingTypeId, 'Setup failed: no existing type found')

      const newSubtype = factory.subtype.build({ typeId: existingTypeId })

      const createResponse = await request(app.callback())
        .post('/component-subtypes')
        .send(newSubtype)

      expect(createResponse.status).toBe(201)
      expect(createResponse.body.content).toMatchObject({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      })

      // Verify by fetching the created subtype
      const getResponse = await request(app.callback()).get(
        `/component-subtypes/${createResponse.body.content.id}`
      )

      expect(getResponse.status).toBe(200)
      expect(getResponse.body.content).toMatchObject({
        subTypeName: newSubtype.subTypeName,
        typeId: existingTypeId,
        quantityType: 'UNIT',
      })

      // Cleanup
      await request(app.callback()).delete(
        `/component-subtypes/${createResponse.body.content.id}`
      )
    })

    it('should reject invalid quantityType enum value', async () => {
      assert(existingTypeId, 'Setup failed: no existing type found')

      const invalidSubtype = {
        subTypeName: `Invalid Subtype ${Date.now()}`,
        typeId: existingTypeId,
        quantityType: 'INVALID_TYPE',
      }

      const response = await request(app.callback())
        .post('/component-subtypes')
        .send(invalidSubtype)

      expect(response.status).toBe(400)
      expect(response.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: expect.arrayContaining(['quantityType']),
            message: expect.stringMatching(/invalid|enum|expected/i),
          }),
        ])
      )
    })

    it('should reject create with missing required fields', async () => {
      assert(existingTypeId, 'Setup failed: no existing type found')

      const incompleteSubtype = {
        typeId: existingTypeId,
        // subTypeName is missing
      }

      const response = await request(app.callback())
        .post('/component-subtypes')
        .send(incompleteSubtype)

      expect(response.status).toBe(400)
      expect(response.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: expect.arrayContaining(['subTypeName']),
            message: expect.stringMatching(/required|missing/i),
          }),
        ])
      )
    })

    it('should return 400 with helpful message when typeId does not exist', async () => {
      const nonExistentTypeId = '00000000-0000-0000-0000-000000000000'

      const invalidSubtype = factory.subtype.build({
        typeId: nonExistentTypeId,
      })

      const response = await request(app.callback())
        .post('/component-subtypes')
        .send(invalidSubtype)

      expect(response.status).toBe(400)
      expect(response.body.error).toBe(
        'Invalid typeId: component type does not exist'
      )
    })
  })

  describe('PUT /component-subtypes/:id', () => {
    it('should update subtype and persist changes', async () => {
      assert(existingTypeId, 'Setup failed: no existing type found')

      // Create a subtype to update
      const originalSubtype = factory.subtype.build({ typeId: existingTypeId })
      const createResponse = await request(app.callback())
        .post('/component-subtypes')
        .send(originalSubtype)

      assert(
        createResponse.status === 201,
        'Setup failed: could not create subtype'
      )
      const subtypeId = createResponse.body.content.id

      // Update the subtype
      const updatedData = {
        subTypeName: `Updated Subtype ${Date.now()}`,
      }

      const updateResponse = await request(app.callback())
        .put(`/component-subtypes/${subtypeId}`)
        .send(updatedData)

      expect(updateResponse.status).toBe(200)
      expect(updateResponse.body.content).toMatchObject({
        subTypeName: updatedData.subTypeName,
      })

      // Verify by fetching
      const getResponse = await request(app.callback()).get(
        `/component-subtypes/${subtypeId}`
      )

      expect(getResponse.status).toBe(200)
      expect(getResponse.body.content).toMatchObject({
        subTypeName: updatedData.subTypeName,
      })

      // Cleanup
      await request(app.callback()).delete(`/component-subtypes/${subtypeId}`)
    })

    it('should return error for non-existent ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000'
      const response = await request(app.callback())
        .put(`/component-subtypes/${nonExistentId}`)
        .send({ subTypeName: 'Updated Name' })

      expect(response.status).toBe(404)
    })
  })

  describe('DELETE /component-subtypes/:id', () => {
    it('should delete subtype successfully when no models exist', async () => {
      assert(existingTypeId, 'Setup failed: no existing type found')

      // Create a subtype specifically for deletion
      const newSubtype = factory.subtype.build({ typeId: existingTypeId })
      const createResponse = await request(app.callback())
        .post('/component-subtypes')
        .send(newSubtype)

      assert(
        createResponse.status === 201,
        'Setup failed: could not create subtype'
      )
      const subtypeId = createResponse.body.content.id

      // Delete the subtype
      const deleteResponse = await request(app.callback()).delete(
        `/component-subtypes/${subtypeId}`
      )

      expect(deleteResponse.status).toBe(204)

      // Verify deletion
      const getResponse = await request(app.callback()).get(
        `/component-subtypes/${subtypeId}`
      )

      expect(getResponse.status).toBe(404)
    })

    it('should return 404 for non-existent ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000'
      const response = await request(app.callback()).delete(
        `/component-subtypes/${nonExistentId}`
      )

      expect(response.status).toBe(404)
    })

    it('should return 409 when subtype has models attached', async () => {
      assert(existingSubtypeId, 'Setup failed: no existing subtype found')

      // Try to delete a subtype that has models (existing subtype should have models)
      const response = await request(app.callback()).delete(
        `/component-subtypes/${existingSubtypeId}`
      )

      // Should fail with 409 Conflict due to FK constraint
      expect(response.status).toBe(409)
      expect(response.body.error).toMatch(/constraint|dependent|models/i)
    })
  })
})
