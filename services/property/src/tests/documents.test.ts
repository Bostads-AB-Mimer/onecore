import request from 'supertest'
import app from '../app'
import * as documentsAdapter from '../adapters/documents-adapter'
import { prisma } from '../adapters/db'

beforeEach(jest.restoreAllMocks)

// Mock document factory
const createMockDocument = (overrides = {}) => ({
  id: '00000000-0000-0000-0000-000000000001',
  fileId: 'file-123',
  componentModelId: null,
  componentInstanceId: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
})

describe('Documents API', () => {
  describe('POST /documents', () => {
    it('creates document for component model', async () => {
      const mockDoc = createMockDocument({
        componentModelId: '00000000-0000-0000-0000-000000000002',
      })

      const createSpy = jest
        .spyOn(documentsAdapter, 'createDocument')
        .mockResolvedValueOnce(mockDoc)

      const res = await request(app.callback()).post('/documents').send({
        fileId: 'file-123',
        componentModelId: '00000000-0000-0000-0000-000000000002',
      })

      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({
        id: mockDoc.id,
        fileId: 'file-123',
        componentModelId: '00000000-0000-0000-0000-000000000002',
      })

      // Verify adapter called with correct params
      expect(createSpy).toHaveBeenCalledWith({
        fileId: 'file-123',
        componentModelId: '00000000-0000-0000-0000-000000000002',
      })
    })

    it('creates document for component instance', async () => {
      const mockDoc = createMockDocument({
        fileId: 'file-456',
        componentInstanceId: '00000000-0000-0000-0000-000000000003',
      })

      const createSpy = jest
        .spyOn(documentsAdapter, 'createDocument')
        .mockResolvedValueOnce(mockDoc)

      const res = await request(app.callback()).post('/documents').send({
        fileId: 'file-456',
        componentInstanceId: '00000000-0000-0000-0000-000000000003',
      })

      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({
        id: mockDoc.id,
        fileId: 'file-456',
        componentInstanceId: '00000000-0000-0000-0000-000000000003',
      })

      // Verify adapter called with correct params
      expect(createSpy).toHaveBeenCalledWith({
        fileId: 'file-456',
        componentInstanceId: '00000000-0000-0000-0000-000000000003',
      })
    })

    it('returns 400 when fileId is missing', async () => {
      const res = await request(app.callback()).post('/documents').send({
        componentModelId: '00000000-0000-0000-0000-000000000002',
      })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('fileId is required')
    })

    it('returns 400 when neither componentModelId nor componentInstanceId provided', async () => {
      const res = await request(app.callback()).post('/documents').send({
        fileId: 'file-123',
      })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe(
        'Either componentModelId or componentInstanceId required'
      )
    })
  })

  describe('GET /documents/component-models/:id', () => {
    it('returns documents for component model', async () => {
      const mockDocs = [
        createMockDocument({
          componentModelId: '00000000-0000-0000-0000-000000000002',
        }),
      ]

      jest.spyOn(prisma.componentModels, 'findUnique').mockResolvedValueOnce({
        id: '00000000-0000-0000-0000-000000000002',
        documents: mockDocs,
      } as any)

      const res = await request(app.callback()).get(
        '/documents/component-models/00000000-0000-0000-0000-000000000002'
      )

      expect(res.status).toBe(200)
      expect(res.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ fileId: 'file-123' }),
        ])
      )
    })

    it('returns empty array when model has no documents', async () => {
      jest.spyOn(prisma.componentModels, 'findUnique').mockResolvedValueOnce({
        id: '00000000-0000-0000-0000-000000000002',
        documents: [],
      } as any)

      const res = await request(app.callback()).get(
        '/documents/component-models/00000000-0000-0000-0000-000000000002'
      )

      expect(res.status).toBe(200)
      expect(res.body).toEqual([])
    })

    it('returns empty array when model not found', async () => {
      jest
        .spyOn(prisma.componentModels, 'findUnique')
        .mockResolvedValueOnce(null)

      const res = await request(app.callback()).get(
        '/documents/component-models/00000000-0000-0000-0000-000000000000'
      )

      expect(res.status).toBe(200)
      expect(res.body).toEqual([])
    })

    it('returns 400 for invalid UUID format', async () => {
      const res = await request(app.callback()).get(
        '/documents/component-models/not-a-valid-uuid'
      )

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Invalid UUID format')
    })
  })

  describe('GET /documents/component-instances/:id', () => {
    it('returns documents for component instance', async () => {
      const mockDocs = [
        createMockDocument({
          componentInstanceId: '00000000-0000-0000-0000-000000000003',
        }),
      ]

      jest.spyOn(prisma.components, 'findUnique').mockResolvedValueOnce({
        id: '00000000-0000-0000-0000-000000000003',
        documents: mockDocs,
      } as any)

      const res = await request(app.callback()).get(
        '/documents/component-instances/00000000-0000-0000-0000-000000000003'
      )

      expect(res.status).toBe(200)
      expect(res.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ fileId: 'file-123' }),
        ])
      )
    })

    it('returns empty array when instance has no documents', async () => {
      jest.spyOn(prisma.components, 'findUnique').mockResolvedValueOnce({
        id: '00000000-0000-0000-0000-000000000003',
        documents: [],
      } as any)

      const res = await request(app.callback()).get(
        '/documents/component-instances/00000000-0000-0000-0000-000000000003'
      )

      expect(res.status).toBe(200)
      expect(res.body).toEqual([])
    })

    it('returns empty array when instance not found', async () => {
      jest.spyOn(prisma.components, 'findUnique').mockResolvedValueOnce(null)

      const res = await request(app.callback()).get(
        '/documents/component-instances/00000000-0000-0000-0000-000000000000'
      )

      expect(res.status).toBe(200)
      expect(res.body).toEqual([])
    })

    it('returns 400 for invalid UUID format', async () => {
      const res = await request(app.callback()).get(
        '/documents/component-instances/not-a-valid-uuid'
      )

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Invalid UUID format')
    })
  })

  describe('DELETE /documents/:id', () => {
    it('returns 204 on successful delete', async () => {
      jest
        .spyOn(documentsAdapter, 'deleteDocument')
        .mockResolvedValueOnce(undefined)

      const res = await request(app.callback()).delete(
        '/documents/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(204)
    })

    it('returns 404 when document not found', async () => {
      jest
        .spyOn(documentsAdapter, 'deleteDocument')
        .mockRejectedValueOnce(new Error('Document not found'))

      const res = await request(app.callback()).delete(
        '/documents/00000000-0000-0000-0000-000000000000'
      )

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('Document not found')
    })

    it('returns 400 for invalid UUID format', async () => {
      const res = await request(app.callback()).delete(
        '/documents/not-a-valid-uuid'
      )

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Invalid UUID format')
    })
  })
})
