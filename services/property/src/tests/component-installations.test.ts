import request from 'supertest'
import assert from 'node:assert'
import app from '../app'
import { factory } from './factories'

describe('Component Installations API', () => {
  let existingComponentId: string

  beforeAll(async () => {
    // Get an existing component for tests
    const componentsResponse = await request(app.callback()).get('/components')
    if (componentsResponse.body.content?.length > 0) {
      existingComponentId = componentsResponse.body.content[0].id
    }
  })

  describe('GET /component-installations', () => {
    it('should return installations filtered by componentId', async () => {
      assert(existingComponentId, 'Setup failed: no existing component found')

      const response = await request(app.callback())
        .get('/component-installations')
        .query({ componentId: existingComponentId })

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        content: expect.any(Array),
      })

      // All returned installations should have the specified componentId
      response.body.content.forEach((installation: { componentId: string }) => {
        expect(installation.componentId).toBe(existingComponentId)
      })
    })

    it('should return installations filtered by spaceId', async () => {
      // First get any installation to find a valid spaceId
      const allResponse = await request(app.callback()).get(
        '/component-installations'
      )
      expect(allResponse.status).toBe(200)

      const installationWithSpaceId = allResponse.body.content.find(
        (i: { spaceId: string | null }) => i.spaceId !== null
      )

      if (!installationWithSpaceId) {
        console.log('No installations with spaceId available to test filter')
        return
      }

      const spaceId = installationWithSpaceId.spaceId

      const response = await request(app.callback())
        .get('/component-installations')
        .query({ spaceId })

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        content: expect.any(Array),
      })

      // All returned installations should have the specified spaceId
      response.body.content.forEach((installation: { spaceId: string }) => {
        expect(installation.spaceId).toBe(spaceId)
      })
    })

    it('should return empty array when filter matches nothing', async () => {
      const nonExistentComponentId = '00000000-0000-0000-0000-000000000000'

      const response = await request(app.callback())
        .get('/component-installations')
        .query({ componentId: nonExistentComponentId })

      expect(response.status).toBe(200)
      expect(response.body.content).toEqual([])
    })
  })

  describe('GET /component-installations/:id', () => {
    it('should return installation when it exists', async () => {
      assert(existingComponentId, 'Setup failed: no existing component found')

      // Create an installation to retrieve
      const newInstallation = factory.installation.build({
        componentId: existingComponentId,
      })
      const createResponse = await request(app.callback())
        .post('/component-installations')
        .send(newInstallation)

      assert(
        createResponse.status === 201,
        'Setup failed: could not create installation'
      )
      const installationId = createResponse.body.content.id

      const response = await request(app.callback()).get(
        `/component-installations/${installationId}`
      )

      expect(response.status).toBe(200)
      expect(response.body.content).toMatchObject({
        id: installationId,
        componentId: existingComponentId,
      })

      // Cleanup
      await request(app.callback()).delete(
        `/component-installations/${installationId}`
      )
    })

    it('should return 404 for non-existent ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000'

      const response = await request(app.callback()).get(
        `/component-installations/${nonExistentId}`
      )

      expect(response.status).toBe(404)
      expect(response.body.error).toMatch(/not found|does not exist/i)
    })

    it('should return 400 for invalid UUID format', async () => {
      const invalidId = 'not-a-valid-uuid'
      const response = await request(app.callback()).get(
        `/component-installations/${invalidId}`
      )

      expect(response.status).toBe(400)
    })
  })

  describe('POST /component-installations', () => {
    it('should create installation and persist data correctly', async () => {
      assert(existingComponentId, 'Setup failed: no existing component found')

      const newInstallation = factory.installation.build({
        componentId: existingComponentId,
        cost: 1500,
      })

      const createResponse = await request(app.callback())
        .post('/component-installations')
        .send(newInstallation)

      expect(createResponse.status).toBe(201)
      expect(createResponse.body.content).toMatchObject({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      })

      // Verify by fetching the created installation
      const getResponse = await request(app.callback()).get(
        `/component-installations/${createResponse.body.content.id}`
      )

      expect(getResponse.status).toBe(200)
      expect(getResponse.body.content).toMatchObject({
        componentId: existingComponentId,
        spaceType: 'OBJECT',
        cost: 1500,
        deinstallationDate: null,
      })

      // Cleanup
      await request(app.callback()).delete(
        `/component-installations/${createResponse.body.content.id}`
      )
    })

    it('should accept both spaceType enum values (OBJECT, PropertyObject)', async () => {
      assert(existingComponentId, 'Setup failed: no existing component found')

      const spaceTypes = ['OBJECT', 'PropertyObject']

      for (const spaceType of spaceTypes) {
        const newInstallation = factory.installation.build({
          componentId: existingComponentId,
          spaceType: spaceType as 'OBJECT' | 'PropertyObject',
        })

        const response = await request(app.callback())
          .post('/component-installations')
          .send(newInstallation)

        expect(response.status).toBe(201)
        expect(response.body.content).toMatchObject({
          spaceType,
        })

        // Cleanup
        await request(app.callback()).delete(
          `/component-installations/${response.body.content.id}`
        )
      }
    })

    it('should reject invalid spaceType enum value', async () => {
      assert(existingComponentId, 'Setup failed: no existing component found')

      const invalidInstallation = {
        componentId: existingComponentId,
        spaceType: 'INVALID_SPACE_TYPE',
        installationDate: new Date().toISOString(),
        cost: 100,
      }

      const response = await request(app.callback())
        .post('/component-installations')
        .send(invalidInstallation)

      expect(response.status).toBe(400)
    })

    it('should reject create with missing required fields', async () => {
      const incompleteInstallation = {
        spaceType: 'OBJECT',
        installationDate: new Date().toISOString(),
        cost: 100,
        // componentId is missing
      }

      const response = await request(app.callback())
        .post('/component-installations')
        .send(incompleteInstallation)

      expect(response.status).toBe(400)
      expect(response.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: expect.arrayContaining(['componentId']),
            message: expect.stringMatching(/required|missing/i),
          }),
        ])
      )
    })

    it('should return 400 with helpful message when componentId does not exist', async () => {
      const nonExistentComponentId = '00000000-0000-0000-0000-000000000000'

      const invalidInstallation = factory.installation.build({
        componentId: nonExistentComponentId,
      })

      const response = await request(app.callback())
        .post('/component-installations')
        .send(invalidInstallation)

      expect(response.status).toBe(400)
      expect(response.body.error).toBe(
        'Invalid componentId: component does not exist'
      )
    })
  })

  describe('PUT /component-installations/:id', () => {
    it('should update installation and persist changes', async () => {
      assert(existingComponentId, 'Setup failed: no existing component found')

      // Create a new installation first
      const newInstallation = factory.installation.build({
        componentId: existingComponentId,
        cost: 500,
      })
      const createResponse = await request(app.callback())
        .post('/component-installations')
        .send(newInstallation)

      assert(
        createResponse.status === 201,
        'Setup failed: could not create installation'
      )
      const installationId = createResponse.body.content.id

      // Update with deinstallationDate
      const deinstallationDate = new Date().toISOString()
      const updateResponse = await request(app.callback())
        .put(`/component-installations/${installationId}`)
        .send({
          deinstallationDate,
          cost: 750,
        })

      expect(updateResponse.status).toBe(200)
      expect(updateResponse.body.content).toMatchObject({
        cost: 750,
      })
      expect(updateResponse.body.content.deinstallationDate).not.toBeNull()

      // Verify by fetching
      const getResponse = await request(app.callback()).get(
        `/component-installations/${installationId}`
      )

      expect(getResponse.status).toBe(200)
      expect(getResponse.body.content).toMatchObject({
        cost: 750,
      })
      expect(getResponse.body.content.deinstallationDate).not.toBeNull()

      // Cleanup
      await request(app.callback()).delete(
        `/component-installations/${installationId}`
      )
    })

    it('should return error for non-existent ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000'
      const response = await request(app.callback())
        .put(`/component-installations/${nonExistentId}`)
        .send({ cost: 100 })

      expect(response.status).toBe(404)
    })

    it('should return 400 when deinstallationDate is before installationDate', async () => {
      assert(existingComponentId, 'Setup failed: no existing component found')

      // Create installation with a known installationDate
      const installationDate = new Date(
        '2024-06-01T00:00:00.000Z'
      ).toISOString()
      const newInstallation = factory.installation.build({
        componentId: existingComponentId,
        installationDate,
      })

      const createResponse = await request(app.callback())
        .post('/component-installations')
        .send(newInstallation)

      assert(
        createResponse.status === 201,
        'Setup failed: could not create installation'
      )
      const installationId = createResponse.body.content.id

      // Try to set deinstallationDate before installationDate (invalid)
      const deinstallationDate = new Date(
        '2024-01-01T00:00:00.000Z'
      ).toISOString()
      const updateResponse = await request(app.callback())
        .put(`/component-installations/${installationId}`)
        .send({ deinstallationDate })

      expect(updateResponse.status).toBe(400)
      expect(updateResponse.body.error).toBe(
        'Deinstallation date cannot be before installation date'
      )

      // Cleanup
      await request(app.callback()).delete(
        `/component-installations/${installationId}`
      )
    })
  })

  describe('PUT /component-installations/:id - Deinstallation Business Rules', () => {
    it('should allow setting deinstallationDate after installationDate', async () => {
      assert(existingComponentId, 'Setup failed: no existing component found')

      // Create installation with past date (use ISO format)
      const installationDate = new Date(
        '2024-01-01T00:00:00.000Z'
      ).toISOString()
      const newInstallation = factory.installation.build({
        componentId: existingComponentId,
        installationDate,
      })

      const createResponse = await request(app.callback())
        .post('/component-installations')
        .send(newInstallation)

      assert(
        createResponse.status === 201,
        `Setup failed: could not create installation (status: ${createResponse.status}, body: ${JSON.stringify(createResponse.body)})`
      )
      const installationId = createResponse.body.content.id

      // Set deinstallation date after installation date (valid)
      const deinstallationDate = new Date(
        '2024-06-01T00:00:00.000Z'
      ).toISOString()
      const updateResponse = await request(app.callback())
        .put(`/component-installations/${installationId}`)
        .send({ deinstallationDate })

      expect(updateResponse.status).toBe(200)
      expect(updateResponse.body.content.deinstallationDate).not.toBeNull()

      // Cleanup
      await request(app.callback()).delete(
        `/component-installations/${installationId}`
      )
    })

    it('should allow creating installation with deinstallationDate already set', async () => {
      assert(existingComponentId, 'Setup failed: no existing component found')

      // Create installation with both dates set (pre-recorded historical data, use ISO format)
      const newInstallation = factory.installation.build({
        componentId: existingComponentId,
        installationDate: new Date('2024-01-01T00:00:00.000Z').toISOString(),
        deinstallationDate: new Date('2024-06-01T00:00:00.000Z').toISOString(),
      })

      const createResponse = await request(app.callback())
        .post('/component-installations')
        .send(newInstallation)

      expect(createResponse.status).toBe(201)
      expect(createResponse.body.content.deinstallationDate).not.toBeNull()

      // Cleanup
      await request(app.callback()).delete(
        `/component-installations/${createResponse.body.content.id}`
      )
    })

    it('should reject negative cost value', async () => {
      assert(existingComponentId, 'Setup failed: no existing component found')

      const invalidInstallation = {
        componentId: existingComponentId,
        spaceType: 'OBJECT',
        installationDate: new Date().toISOString(),
        cost: -100, // Negative cost should be rejected
      }

      const response = await request(app.callback())
        .post('/component-installations')
        .send(invalidInstallation)

      expect(response.status).toBe(400)
    })
  })

  describe('DELETE /component-installations/:id', () => {
    it('should delete installation successfully', async () => {
      assert(existingComponentId, 'Setup failed: no existing component found')

      // Create an installation specifically for deletion
      const newInstallation = factory.installation.build({
        componentId: existingComponentId,
      })
      const createResponse = await request(app.callback())
        .post('/component-installations')
        .send(newInstallation)

      assert(
        createResponse.status === 201,
        'Setup failed: could not create installation'
      )
      const installationId = createResponse.body.content.id

      // Delete the installation
      const deleteResponse = await request(app.callback()).delete(
        `/component-installations/${installationId}`
      )

      expect(deleteResponse.status).toBe(204)

      // Verify deletion
      const getResponse = await request(app.callback()).get(
        `/component-installations/${installationId}`
      )

      expect(getResponse.status).toBe(404)
    })

    it('should return 404 for non-existent ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000'
      const response = await request(app.callback()).delete(
        `/component-installations/${nonExistentId}`
      )

      expect(response.status).toBe(404)
    })
  })
})
