import request from 'supertest'
import assert from 'node:assert'
import app from '../app'
import { factory } from './factories'

describe('Component Categories API', () => {
  let existingCategoryId: string

  beforeAll(async () => {
    // Get an existing category ID for tests that need it
    const response = await request(app.callback()).get('/component-categories')
    if (response.body.content && response.body.content.length > 0) {
      existingCategoryId = response.body.content[0].id
    }
  })

  describe('GET /component-categories', () => {
    it('should return paginated categories with default pagination', async () => {
      const response = await request(app.callback()).get(
        '/component-categories'
      )

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        content: expect.any(Array),
        pagination: {
          page: 1,
          limit: 20,
        },
      })

      if (response.body.content.length > 0) {
        expect(response.body.content[0]).toMatchObject({
          id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
          categoryName: expect.any(String),
          description: expect.any(String),
        })
      }
    })

    it('should reject invalid pagination (page < 1)', async () => {
      const response = await request(app.callback())
        .get('/component-categories')
        .query({ page: 0 })

      expect(response.status).toBe(400)
      expect(response.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: expect.arrayContaining(['page']),
            message: expect.stringMatching(
              /greater than|at least|minimum|too_small/i
            ),
          }),
        ])
      )
    })

    it('should reject invalid pagination (limit > 100)', async () => {
      const response = await request(app.callback())
        .get('/component-categories')
        .query({ limit: 101 })

      expect(response.status).toBe(400)
      expect(response.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: expect.arrayContaining(['limit']),
            message: expect.stringMatching(
              /less than|at most|maximum|too_big/i
            ),
          }),
        ])
      )
    })

    it('should return empty array when page exceeds available data', async () => {
      const response = await request(app.callback())
        .get('/component-categories')
        .query({ page: 9999 })

      expect(response.status).toBe(200)
      expect(response.body.content).toEqual([])
    })
  })

  describe('GET /component-categories/:id', () => {
    it('should return category when it exists', async () => {
      assert(existingCategoryId, 'Setup failed: no existing category found')

      const response = await request(app.callback()).get(
        `/component-categories/${existingCategoryId}`
      )

      expect(response.status).toBe(200)
      expect(response.body.content).toMatchObject({
        id: existingCategoryId,
        categoryName: expect.any(String),
        description: expect.any(String),
      })
    })

    it('should return 404 for non-existent ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000'
      const response = await request(app.callback()).get(
        `/component-categories/${nonExistentId}`
      )

      expect(response.status).toBe(404)
      expect(response.body.error).toMatch(/not found|does not exist/i)
    })

    it('should return 400 for invalid UUID format', async () => {
      const invalidId = 'not-a-valid-uuid'
      const response = await request(app.callback()).get(
        `/component-categories/${invalidId}`
      )

      expect(response.status).toBe(400)
    })
  })

  describe('POST /component-categories', () => {
    it('should create category and persist data correctly', async () => {
      const newCategory = factory.category.build()

      const createResponse = await request(app.callback())
        .post('/component-categories')
        .send(newCategory)

      expect(createResponse.status).toBe(201)
      expect(createResponse.body.content).toMatchObject({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      })

      // Verify by fetching the created category
      const getResponse = await request(app.callback()).get(
        `/component-categories/${createResponse.body.content.id}`
      )

      expect(getResponse.status).toBe(200)
      expect(getResponse.body.content).toMatchObject({
        categoryName: newCategory.categoryName,
        description: newCategory.description,
      })

      // Cleanup
      await request(app.callback()).delete(
        `/component-categories/${createResponse.body.content.id}`
      )
    })

    it('should reject create with missing required fields', async () => {
      const incompleteCategory = {
        categoryName: 'Missing Description',
        // description is missing
      }

      const response = await request(app.callback())
        .post('/component-categories')
        .send(incompleteCategory)

      expect(response.status).toBe(400)
      expect(response.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: expect.arrayContaining(['description']),
            message: expect.stringMatching(/required|missing/i),
          }),
        ])
      )
    })
  })

  describe('PUT /component-categories/:id', () => {
    it('should update category and persist changes', async () => {
      // Create a category to update
      const originalCategory = factory.category.build()
      const createResponse = await request(app.callback())
        .post('/component-categories')
        .send(originalCategory)

      assert(
        createResponse.status === 201,
        'Setup failed: could not create category'
      )
      const categoryId = createResponse.body.content.id

      // Update the category
      const updatedData = factory.category.build()

      const updateResponse = await request(app.callback())
        .put(`/component-categories/${categoryId}`)
        .send(updatedData)

      expect(updateResponse.status).toBe(200)
      expect(updateResponse.body.content).toMatchObject({
        categoryName: updatedData.categoryName,
        description: updatedData.description,
      })

      // Verify by fetching
      const getResponse = await request(app.callback()).get(
        `/component-categories/${categoryId}`
      )

      expect(getResponse.status).toBe(200)
      expect(getResponse.body.content).toMatchObject({
        categoryName: updatedData.categoryName,
        description: updatedData.description,
      })

      // Cleanup
      await request(app.callback()).delete(
        `/component-categories/${categoryId}`
      )
    })

    it('should allow partial update (only categoryName)', async () => {
      // Create a category to update
      const originalCategory = factory.category.build()
      const createResponse = await request(app.callback())
        .post('/component-categories')
        .send(originalCategory)

      assert(
        createResponse.status === 201,
        'Setup failed: could not create category'
      )
      const categoryId = createResponse.body.content.id

      // Update only categoryName
      const newName = `Updated Name Only ${Date.now()}`
      const updateResponse = await request(app.callback())
        .put(`/component-categories/${categoryId}`)
        .send({ categoryName: newName })

      expect(updateResponse.status).toBe(200)
      expect(updateResponse.body.content).toMatchObject({
        categoryName: newName,
        description: originalCategory.description, // Should remain unchanged
      })

      // Cleanup
      await request(app.callback()).delete(
        `/component-categories/${categoryId}`
      )
    })

    it('should return error for non-existent ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000'
      const response = await request(app.callback())
        .put(`/component-categories/${nonExistentId}`)
        .send({ categoryName: 'Updated Name' })

      expect(response.status).toBe(404)
    })
  })

  describe('DELETE /component-categories/:id', () => {
    it('should delete category successfully when no types exist', async () => {
      // Create a category specifically for deletion
      const newCategory = factory.category.build()
      const createResponse = await request(app.callback())
        .post('/component-categories')
        .send(newCategory)

      assert(
        createResponse.status === 201,
        'Setup failed: could not create category'
      )
      const categoryId = createResponse.body.content.id

      // Delete the category
      const deleteResponse = await request(app.callback()).delete(
        `/component-categories/${categoryId}`
      )

      expect(deleteResponse.status).toBe(204)

      // Verify deletion
      const getResponse = await request(app.callback()).get(
        `/component-categories/${categoryId}`
      )

      expect(getResponse.status).toBe(404)
    })

    it('should return 404 for non-existent ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000'
      const response = await request(app.callback()).delete(
        `/component-categories/${nonExistentId}`
      )

      expect(response.status).toBe(404)
    })
  })
})
