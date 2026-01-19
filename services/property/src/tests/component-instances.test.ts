import request from 'supertest'
import assert from 'node:assert'
import app from '../app'
import { factory } from './factories'

describe('Component Instances API', () => {
  let existingModelId: string
  let existingComponentId: string

  beforeAll(async () => {
    // Get an existing model for tests
    const modelsResponse = await request(app.callback()).get('/component-models')
    if (modelsResponse.body.content?.length > 0) {
      existingModelId = modelsResponse.body.content[0].id
    }

    // Get an existing component for tests
    const componentsResponse = await request(app.callback()).get('/components')
    if (componentsResponse.body.content?.length > 0) {
      existingComponentId = componentsResponse.body.content[0].id
    }
  })

  describe('GET /components', () => {
    it('should return components filtered by status enum (ACTIVE, INACTIVE, MAINTENANCE, DECOMMISSIONED)', async () => {
      const statuses = ['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'DECOMMISSIONED']

      for (const status of statuses) {
        const response = await request(app.callback())
          .get('/components')
          .query({ status })

        expect(response.status).toBe(200)
        expect(response.body).toMatchObject({
          content: expect.any(Array),
        })

        // All returned components should have the specified status
        response.body.content.forEach((component: { status: string }) => {
          expect(component.status).toBe(status)
        })
      }
    })

    it('should search by serialNumber with 2+ characters', async () => {
      const allResponse = await request(app.callback()).get('/components')
      expect(allResponse.status).toBe(200)

      if (
        allResponse.body.content.length === 0 ||
        !allResponse.body.content[0].serialNumber
      ) {
        console.log('No components with serialNumber available to test search')
        return
      }

      // Get first 2 chars of an existing serial number
      const existingSerial = allResponse.body.content[0].serialNumber
      const searchTerm = existingSerial.substring(0, 2)

      const response = await request(app.callback())
        .get('/components')
        .query({ serialNumber: searchTerm })

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        content: expect.any(Array),
      })

      // All results should contain the search term in serialNumber
      response.body.content.forEach((component: { serialNumber: string }) => {
        expect(
          component.serialNumber.toLowerCase().includes(searchTerm.toLowerCase())
        ).toBe(true)
      })
    })

    it('should ignore serialNumber search with < 2 chars (returns all)', async () => {
      // Get total count without filter
      const allResponse = await request(app.callback()).get('/components')
      expect(allResponse.status).toBe(200)

      // Search with single character - should be ignored
      const response = await request(app.callback())
        .get('/components')
        .query({ serialNumber: 'A' })

      expect(response.status).toBe(200)

      // Should return same total as unfiltered (search ignored)
      expect(response.body.pagination.total).toBe(
        allResponse.body.pagination.total
      )
    })

    it('should reject invalid status enum value', async () => {
      const response = await request(app.callback())
        .get('/components')
        .query({ status: 'INVALID_STATUS' })

      // Should return 400 for invalid enum value
      expect(response.status).toBe(400)
    })

    it('should return empty array when filter matches nothing', async () => {
      const nonExistentModelId = '00000000-0000-0000-0000-000000000000'

      const response = await request(app.callback())
        .get('/components')
        .query({ modelId: nonExistentModelId })

      expect(response.status).toBe(200)
      expect(response.body.content).toEqual([])
    })
  })

  describe('GET /components/:id', () => {
    it('should return component when it exists', async () => {
      assert(existingComponentId, 'Setup failed: no existing component found')

      const response = await request(app.callback()).get(
        `/components/${existingComponentId}`
      )

      expect(response.status).toBe(200)
      expect(response.body.content).toMatchObject({
        id: existingComponentId,
        modelId: expect.any(String),
        status: expect.any(String),
      })
    })

    it('should return 404 for non-existent ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000'
      const response = await request(app.callback()).get(
        `/components/${nonExistentId}`
      )

      expect(response.status).toBe(404)
      expect(response.body.error).toMatch(/not found|does not exist/i)
    })

    it('should return 400 for invalid UUID format', async () => {
      const invalidId = 'not-a-valid-uuid'
      const response = await request(app.callback()).get(
        `/components/${invalidId}`
      )

      expect(response.status).toBe(400)
    })
  })

  describe('GET /components/by-room/:roomId', () => {
    it('should return components by room ID', async () => {
      // First get any component with an installation to find a valid roomId
      const componentsResponse = await request(app.callback()).get('/components')
      expect(componentsResponse.status).toBe(200)

      const componentWithInstallation = componentsResponse.body.content.find(
        (c: { componentInstallations?: Array<{ spaceId: string }> }) =>
          c.componentInstallations?.length > 0 &&
          c.componentInstallations[0].spaceId
      )

      if (!componentWithInstallation) {
        console.log('No components with installations available to test by-room')
        return
      }

      const roomId = componentWithInstallation.componentInstallations[0].spaceId

      const response = await request(app.callback()).get(
        `/components/by-room/${roomId}`
      )

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        content: expect.any(Array),
      })
      expect(response.body.content.length).toBeGreaterThan(0)

      // All returned components should have an installation in the specified room
      response.body.content.forEach(
        (component: {
          componentInstallations?: Array<{
            spaceId: string
            deinstallationDate: string | null
          }>
        }) => {
          expect(component.componentInstallations).toBeDefined()
          expect(component.componentInstallations?.length).toBeGreaterThan(0)
          const installation = component.componentInstallations?.[0]
          expect(installation?.spaceId).toBe(roomId)
          expect(installation?.deinstallationDate).toBeNull()
        }
      )
    })

    it('should validate roomId max length (15 chars)', async () => {
      const tooLongRoomId = 'A'.repeat(16)

      const response = await request(app.callback()).get(
        `/components/by-room/${tooLongRoomId}`
      )

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('15 characters')
    })
  })

  describe('POST /components', () => {
    it('should create component and persist data correctly (default status ACTIVE)', async () => {
      assert(existingModelId, 'Setup failed: no existing model found')

      const newComponent = factory.component.build({ modelId: existingModelId })

      const createResponse = await request(app.callback())
        .post('/components')
        .send(newComponent)

      expect(createResponse.status).toBe(201)
      expect(createResponse.body.content).toMatchObject({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      })

      // Verify by fetching the created component
      const getResponse = await request(app.callback()).get(
        `/components/${createResponse.body.content.id}`
      )

      expect(getResponse.status).toBe(200)
      expect(getResponse.body.content).toMatchObject({
        modelId: existingModelId,
        serialNumber: newComponent.serialNumber,
        status: 'ACTIVE', // Default status
      })

      // Cleanup
      await request(app.callback()).delete(
        `/components/${createResponse.body.content.id}`
      )
    })

    it('should reject create with missing required fields', async () => {
      const incompleteComponent = {
        serialNumber: `SN-${Date.now()}`,
        // modelId is missing
      }

      const response = await request(app.callback())
        .post('/components')
        .send(incompleteComponent)

      expect(response.status).toBe(400)
      expect(response.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: expect.arrayContaining(['modelId']),
            message: expect.stringMatching(/required|missing/i),
          }),
        ])
      )
    })
  })

  describe('PUT /components/:id', () => {
    it('should update component status and persist changes', async () => {
      assert(existingModelId, 'Setup failed: no existing model found')

      // Create a component to update
      const newComponent = factory.component.build({ modelId: existingModelId })
      const createResponse = await request(app.callback())
        .post('/components')
        .send(newComponent)

      assert(
        createResponse.status === 201,
        'Setup failed: could not create component'
      )
      const componentId = createResponse.body.content.id

      // Update the component status
      const updatedData = {
        status: 'INACTIVE',
      }

      const updateResponse = await request(app.callback())
        .put(`/components/${componentId}`)
        .send(updatedData)

      expect(updateResponse.status).toBe(200)
      expect(updateResponse.body.content).toMatchObject({
        status: 'INACTIVE',
      })

      // Verify by fetching
      const getResponse = await request(app.callback()).get(
        `/components/${componentId}`
      )

      expect(getResponse.status).toBe(200)
      expect(getResponse.body.content).toMatchObject({
        status: 'INACTIVE',
      })

      // Cleanup
      await request(app.callback()).delete(`/components/${componentId}`)
    })

    it('should return error for non-existent ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000'
      const response = await request(app.callback())
        .put(`/components/${nonExistentId}`)
        .send({ status: 'INACTIVE' })

      expect(response.status).toBe(404)
    })

    it('should reject invalid status enum value', async () => {
      assert(existingComponentId, 'Setup failed: no existing component found')

      const response = await request(app.callback())
        .put(`/components/${existingComponentId}`)
        .send({ status: 'INVALID_STATUS' })

      expect(response.status).toBe(400)
    })
  })

  describe('DELETE /components/:id', () => {
    it('should cascade delete to installations (deleting component removes its installations)', async () => {
      assert(existingModelId, 'Setup failed: no existing model found')

      // Create a new component
      const newComponent = factory.component.build({ modelId: existingModelId })
      const createComponentResponse = await request(app.callback())
        .post('/components')
        .send(newComponent)

      assert(
        createComponentResponse.status === 201,
        `Setup failed: could not create component (${createComponentResponse.status})`
      )
      const componentId = createComponentResponse.body.content.id

      // Create an installation for this component
      const newInstallation = factory.installation.build({ componentId })
      const createInstallationResponse = await request(app.callback())
        .post('/component-installations')
        .send(newInstallation)

      assert(
        createInstallationResponse.status === 201,
        `Setup failed: could not create installation (${createInstallationResponse.status})`
      )
      const installationId = createInstallationResponse.body.content.id

      // Verify installation exists
      const getInstallationResponse = await request(app.callback()).get(
        `/component-installations/${installationId}`
      )
      expect(getInstallationResponse.status).toBe(200)

      // Delete the component
      const deleteResponse = await request(app.callback()).delete(
        `/components/${componentId}`
      )
      expect(deleteResponse.status).toBe(204)

      // Verify installation was cascade deleted
      const getInstallationAfterDelete = await request(app.callback()).get(
        `/component-installations/${installationId}`
      )
      expect(getInstallationAfterDelete.status).toBe(404)
    })
  })
})
