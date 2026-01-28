import request from 'supertest'
import assert from 'node:assert'
import app from '../app'
import { factory } from './factories'

describe('Component Types API', () => {
  let existingCategoryId: string
  let existingTypeId: string

  beforeAll(async () => {
    // Get an existing category ID for tests
    const categoriesResponse = await request(app.callback()).get(
      '/component-categories'
    )
    if (categoriesResponse.body.content?.length > 0) {
      existingCategoryId = categoriesResponse.body.content[0].id
    }

    // Get an existing type ID for tests
    const typesResponse = await request(app.callback()).get('/component-types')
    if (typesResponse.body.content?.length > 0) {
      existingTypeId = typesResponse.body.content[0].id
    }
  })

  describe('GET /component-types', () => {
    it('should return types filtered by categoryId', async () => {
      assert(existingCategoryId, 'Setup failed: no existing category found')

      const response = await request(app.callback())
        .get('/component-types')
        .query({ categoryId: existingCategoryId })

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        content: expect.any(Array),
      })

      // All returned types should belong to the specified category
      response.body.content.forEach((type: { categoryId: string }) => {
        expect(type.categoryId).toBe(existingCategoryId)
      })
    })

    it('should return all types when no filter provided', async () => {
      const response = await request(app.callback()).get('/component-types')

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        content: expect.any(Array),
        pagination: {
          page: 1,
          limit: 20,
        },
      })
    })

    it('should return empty array when filter matches nothing', async () => {
      const nonExistentCategoryId = '00000000-0000-0000-0000-000000000000'

      const response = await request(app.callback())
        .get('/component-types')
        .query({ categoryId: nonExistentCategoryId })

      expect(response.status).toBe(200)
      expect(response.body.content).toEqual([])
    })
  })

  describe('GET /component-types/:id', () => {
    it('should return type when it exists', async () => {
      assert(existingTypeId, 'Setup failed: no existing type found')

      const response = await request(app.callback()).get(
        `/component-types/${existingTypeId}`
      )

      expect(response.status).toBe(200)
      expect(response.body.content).toMatchObject({
        id: existingTypeId,
        typeName: expect.any(String),
        categoryId: expect.any(String),
      })
    })

    it('should return 404 for non-existent ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000'
      const response = await request(app.callback()).get(
        `/component-types/${nonExistentId}`
      )

      expect(response.status).toBe(404)
      expect(response.body.error).toMatch(/not found|does not exist/i)
    })

    it('should return 400 for invalid UUID format', async () => {
      const invalidId = 'not-a-valid-uuid'
      const response = await request(app.callback()).get(
        `/component-types/${invalidId}`
      )

      expect(response.status).toBe(400)
    })
  })

  describe('POST /component-types', () => {
    it('should create type and persist data correctly', async () => {
      assert(existingCategoryId, 'Setup failed: no existing category found')

      const newType = factory.type.build({ categoryId: existingCategoryId })

      const createResponse = await request(app.callback())
        .post('/component-types')
        .send(newType)

      expect(createResponse.status).toBe(201)
      expect(createResponse.body.content).toMatchObject({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      })

      // Verify by fetching the created type
      const getResponse = await request(app.callback()).get(
        `/component-types/${createResponse.body.content.id}`
      )

      expect(getResponse.status).toBe(200)
      expect(getResponse.body.content).toMatchObject({
        typeName: newType.typeName,
        categoryId: existingCategoryId,
      })

      // Cleanup
      await request(app.callback()).delete(
        `/component-types/${createResponse.body.content.id}`
      )
    })

    it('should reject create with non-existent categoryId', async () => {
      const nonExistentCategoryId = '00000000-0000-0000-0000-000000000000'
      const newType = factory.type.build({ categoryId: nonExistentCategoryId })

      const response = await request(app.callback())
        .post('/component-types')
        .send(newType)

      // Should fail with 400 due to FK constraint
      expect(response.status).toBe(400)
      expect(response.body.error).toMatch(/invalid|category|does not exist/i)
    })

    it('should reject create with missing required fields', async () => {
      assert(existingCategoryId, 'Setup failed: no existing category found')

      const incompleteType = {
        categoryId: existingCategoryId,
        // typeName is missing
      }

      const response = await request(app.callback())
        .post('/component-types')
        .send(incompleteType)

      expect(response.status).toBe(400)
      expect(response.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: expect.arrayContaining(['typeName']),
            message: expect.stringMatching(/required|missing/i),
          }),
        ])
      )
    })
  })

  describe('PUT /component-types/:id', () => {
    it('should update type and persist changes', async () => {
      assert(existingCategoryId, 'Setup failed: no existing category found')

      // Create a type to update
      const originalType = factory.type.build({
        categoryId: existingCategoryId,
      })
      const createResponse = await request(app.callback())
        .post('/component-types')
        .send(originalType)

      assert(
        createResponse.status === 201,
        'Setup failed: could not create type'
      )
      const typeId = createResponse.body.content.id

      // Update the type
      const updatedData = {
        typeName: `Updated Type ${Date.now()}`,
      }

      const updateResponse = await request(app.callback())
        .put(`/component-types/${typeId}`)
        .send(updatedData)

      expect(updateResponse.status).toBe(200)
      expect(updateResponse.body.content).toMatchObject({
        typeName: updatedData.typeName,
      })

      // Verify by fetching
      const getResponse = await request(app.callback()).get(
        `/component-types/${typeId}`
      )

      expect(getResponse.status).toBe(200)
      expect(getResponse.body.content).toMatchObject({
        typeName: updatedData.typeName,
      })

      // Cleanup
      await request(app.callback()).delete(`/component-types/${typeId}`)
    })

    it('should return error for non-existent ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000'
      const response = await request(app.callback())
        .put(`/component-types/${nonExistentId}`)
        .send({ typeName: 'Updated Name' })

      expect(response.status).toBe(404)
    })
  })

  describe('DELETE /component-types/:id', () => {
    it('should delete type successfully when no subtypes exist', async () => {
      assert(existingCategoryId, 'Setup failed: no existing category found')

      // Create a type specifically for deletion
      const newType = factory.type.build({ categoryId: existingCategoryId })
      const createResponse = await request(app.callback())
        .post('/component-types')
        .send(newType)

      assert(
        createResponse.status === 201,
        'Setup failed: could not create type'
      )
      const typeId = createResponse.body.content.id

      // Delete the type
      const deleteResponse = await request(app.callback()).delete(
        `/component-types/${typeId}`
      )

      expect(deleteResponse.status).toBe(204)

      // Verify deletion
      const getResponse = await request(app.callback()).get(
        `/component-types/${typeId}`
      )

      expect(getResponse.status).toBe(404)
    })

    it('should return 404 for non-existent ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000'
      const response = await request(app.callback()).delete(
        `/component-types/${nonExistentId}`
      )

      expect(response.status).toBe(404)
    })

    it('should return 409 when type has subtypes attached', async () => {
      assert(existingTypeId, 'Setup failed: no existing type found')

      // Try to delete a type that has subtypes (existing type should have subtypes)
      const response = await request(app.callback()).delete(
        `/component-types/${existingTypeId}`
      )

      // Should fail with 409 Conflict due to FK constraint
      expect(response.status).toBe(409)
      expect(response.body.error).toMatch(/constraint|dependent|subtypes/i)
    })
  })
})
