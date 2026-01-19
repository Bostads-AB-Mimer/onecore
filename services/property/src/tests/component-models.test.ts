import request from 'supertest'
import assert from 'node:assert'
import app from '../app'
import { factory } from './factories'

describe('Component Models API', () => {
  let existingSubtypeId: string
  let existingModelId: string
  let existingModelName: string

  beforeAll(async () => {
    // Get an existing subtype ID for tests
    const subtypesResponse = await request(app.callback()).get(
      '/component-subtypes'
    )
    if (subtypesResponse.body.content?.length > 0) {
      existingSubtypeId = subtypesResponse.body.content[0].id
    }

    // Get an existing model for tests
    const modelsResponse = await request(app.callback()).get(
      '/component-models'
    )
    if (modelsResponse.body.content?.length > 0) {
      existingModelId = modelsResponse.body.content[0].id
      existingModelName = modelsResponse.body.content[0].modelName
    }
  })

  describe('GET /component-models', () => {
    it('should return models filtered by subtypeId', async () => {
      assert(existingSubtypeId, 'Setup failed: no existing subtype found')

      const response = await request(app.callback())
        .get('/component-models')
        .query({ subtypeId: existingSubtypeId })

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        content: expect.any(Array),
      })

      // All returned models should belong to the specified subtype
      response.body.content.forEach((model: { componentSubtypeId: string }) => {
        expect(model.componentSubtypeId).toBe(existingSubtypeId)
      })
    })

    it('should search by modelName with 2+ characters', async () => {
      // First get a model to know a valid name to search for
      const allResponse = await request(app.callback()).get('/component-models')
      expect(allResponse.status).toBe(200)

      if (allResponse.body.content.length === 0) {
        console.log('No models available to test search')
        return
      }

      // Get first 3 chars of an existing model name for more specific search
      const existingName = allResponse.body.content[0].modelName
      const searchTerm = existingName.substring(0, 3)

      const response = await request(app.callback())
        .get('/component-models')
        .query({ modelName: searchTerm })

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        content: expect.any(Array),
      })
      // Search should return results (at least the one we got the name from)
      expect(response.body.content.length).toBeGreaterThan(0)
    })

    it('should return empty array when filter matches nothing', async () => {
      const nonExistentSubtypeId = '00000000-0000-0000-0000-000000000000'

      const response = await request(app.callback())
        .get('/component-models')
        .query({ subtypeId: nonExistentSubtypeId })

      expect(response.status).toBe(200)
      expect(response.body.content).toEqual([])
    })
  })

  describe('GET /component-models/:id', () => {
    it('should return model when it exists', async () => {
      assert(existingModelId, 'Setup failed: no existing model found')

      const response = await request(app.callback()).get(
        `/component-models/${existingModelId}`
      )

      expect(response.status).toBe(200)
      expect(response.body.content).toMatchObject({
        id: existingModelId,
        modelName: expect.any(String),
        componentSubtypeId: expect.any(String),
      })
    })

    it('should return 404 for non-existent ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000'
      const response = await request(app.callback()).get(
        `/component-models/${nonExistentId}`
      )

      expect(response.status).toBe(404)
      expect(response.body.error).toMatch(/not found|does not exist/i)
    })

    it('should return 400 for invalid UUID format', async () => {
      const invalidId = 'not-a-valid-uuid'
      const response = await request(app.callback()).get(
        `/component-models/${invalidId}`
      )

      expect(response.status).toBe(400)
    })
  })

  describe('GET /component-models/by-name/:modelName', () => {
    it('should find model by exact name', async () => {
      assert(existingModelName, 'Setup failed: no existing model found')

      const response = await request(app.callback()).get(
        `/component-models/by-name/${encodeURIComponent(existingModelName)}`
      )

      expect(response.status).toBe(200)
      expect(response.body.content).toMatchObject({
        modelName: existingModelName,
      })
    })

    it('should return 404 for non-existent model by name', async () => {
      const nonExistentName = `NonExistent_Model_${Date.now()}`

      const response = await request(app.callback()).get(
        `/component-models/by-name/${encodeURIComponent(nonExistentName)}`
      )

      expect(response.status).toBe(404)
      expect(response.body.error).toMatch(/not found|does not exist/i)
    })
  })

  describe('POST /component-models', () => {
    it('should create model and persist data correctly', async () => {
      assert(existingSubtypeId, 'Setup failed: no existing subtype found')

      const newModel = factory.model.build({
        componentSubtypeId: existingSubtypeId,
      })

      const createResponse = await request(app.callback())
        .post('/component-models')
        .send(newModel)

      expect(createResponse.status).toBe(201)
      expect(createResponse.body.content).toMatchObject({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      })

      // Verify by fetching the created model
      const getResponse = await request(app.callback()).get(
        `/component-models/${createResponse.body.content.id}`
      )

      expect(getResponse.status).toBe(200)
      expect(getResponse.body.content).toMatchObject({
        modelName: newModel.modelName,
        componentSubtypeId: existingSubtypeId,
      })

      // Cleanup
      await request(app.callback()).delete(
        `/component-models/${createResponse.body.content.id}`
      )
    })

    it('should reject create with missing required fields', async () => {
      assert(existingSubtypeId, 'Setup failed: no existing subtype found')

      const incompleteModel = {
        componentSubtypeId: existingSubtypeId,
        // modelName is missing
      }

      const response = await request(app.callback())
        .post('/component-models')
        .send(incompleteModel)

      expect(response.status).toBe(400)
      expect(response.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: expect.arrayContaining(['modelName']),
            message: expect.stringMatching(/required|missing/i),
          }),
        ])
      )
    })
  })

  describe('PUT /component-models/:id', () => {
    it('should update model and persist changes', async () => {
      assert(existingSubtypeId, 'Setup failed: no existing subtype found')

      // Create a model to update
      const originalModel = factory.model.build({
        componentSubtypeId: existingSubtypeId,
      })
      const createResponse = await request(app.callback())
        .post('/component-models')
        .send(originalModel)

      assert(
        createResponse.status === 201,
        'Setup failed: could not create model'
      )
      const modelId = createResponse.body.content.id

      // Update the model
      const updatedData = {
        modelName: `Updated Model ${Date.now()}`,
      }

      const updateResponse = await request(app.callback())
        .put(`/component-models/${modelId}`)
        .send(updatedData)

      expect(updateResponse.status).toBe(200)
      expect(updateResponse.body.content).toMatchObject({
        modelName: updatedData.modelName,
      })

      // Verify by fetching
      const getResponse = await request(app.callback()).get(
        `/component-models/${modelId}`
      )

      expect(getResponse.status).toBe(200)
      expect(getResponse.body.content).toMatchObject({
        modelName: updatedData.modelName,
      })

      // Cleanup
      await request(app.callback()).delete(`/component-models/${modelId}`)
    })

    it('should return error for non-existent ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000'
      const response = await request(app.callback())
        .put(`/component-models/${nonExistentId}`)
        .send({ modelName: 'Updated Name' })

      expect(response.status).toBe(404)
    })
  })

  describe('DELETE /component-models/:id', () => {
    it('should delete model successfully when no components exist', async () => {
      assert(existingSubtypeId, 'Setup failed: no existing subtype found')

      // Create a model specifically for deletion
      const newModel = factory.model.build({
        componentSubtypeId: existingSubtypeId,
      })
      const createResponse = await request(app.callback())
        .post('/component-models')
        .send(newModel)

      assert(
        createResponse.status === 201,
        'Setup failed: could not create model'
      )
      const modelId = createResponse.body.content.id

      // Delete the model
      const deleteResponse = await request(app.callback()).delete(
        `/component-models/${modelId}`
      )

      expect(deleteResponse.status).toBe(204)

      // Verify deletion
      const getResponse = await request(app.callback()).get(
        `/component-models/${modelId}`
      )

      expect(getResponse.status).toBe(404)
    })

    it('should return 404 for non-existent ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000'
      const response = await request(app.callback()).delete(
        `/component-models/${nonExistentId}`
      )

      expect(response.status).toBe(404)
    })

    it('should return 409 when model has components attached', async () => {
      assert(existingModelId, 'Setup failed: no existing model found')

      // Try to delete a model that has components (existing model should have components)
      const response = await request(app.callback()).delete(
        `/component-models/${existingModelId}`
      )

      // Should fail with 409 Conflict due to FK constraint
      expect(response.status).toBe(409)
      expect(response.body.error).toMatch(/constraint|dependent|components/i)
    })
  })
})
