import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes } from '../../routes/listing-text-content'
import listingTextContentAdapter from '../../adapters/listing-text-content-adapter'
import * as factory from '../factories'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

beforeEach(jest.restoreAllMocks)

describe('listing-text-content routes', () => {
  describe('GET /listing-text-content/:rentalObjectCode', () => {
    it('responds with 200 and content when found', async () => {
      const testData = factory.listingTextContent.build()
      jest
        .spyOn(listingTextContentAdapter, 'getByRentalObjectCode')
        .mockResolvedValueOnce(testData)

      const res = await request(app.callback()).get(
        `/listing-text-content/${testData.rentalObjectCode}`
      )

      expect(res.status).toBe(200)
      expect(res.body.content.rentalObjectCode).toBe(testData.rentalObjectCode)
      expect(res.body.content.contentBlocks).toEqual(testData.contentBlocks)
    })

    it('responds with 404 when not found', async () => {
      jest
        .spyOn(listingTextContentAdapter, 'getByRentalObjectCode')
        .mockResolvedValueOnce(undefined)

      const res = await request(app.callback()).get(
        '/listing-text-content/NON_EXISTENT'
      )

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('Listing text content not found')
    })
  })

  describe('POST /listing-text-content', () => {
    it('responds with 201 on success', async () => {
      const testData = factory.listingTextContent.build()
      jest.spyOn(listingTextContentAdapter, 'create').mockResolvedValueOnce({
        ok: true,
        data: testData,
      })

      const res = await request(app.callback())
        .post('/listing-text-content')
        .send({
          rentalObjectCode: testData.rentalObjectCode,
          contentBlocks: testData.contentBlocks,
        })

      expect(res.status).toBe(201)
      expect(res.body.content.rentalObjectCode).toBe(testData.rentalObjectCode)
    })

    it('responds with 400 for invalid body', async () => {
      const res = await request(app.callback())
        .post('/listing-text-content')
        .send({
          // Missing required fields
          contentBlocks: 'invalid',
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Invalid request body')
    })

    it('responds with 400 for invalid content block type', async () => {
      const res = await request(app.callback())
        .post('/listing-text-content')
        .send({
          rentalObjectCode: 'TEST123',
          contentBlocks: [{ type: 'invalid_type', content: 'test' }],
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Invalid request body')
    })

    it('responds with 409 for duplicate rental object code', async () => {
      jest.spyOn(listingTextContentAdapter, 'create').mockResolvedValueOnce({
        ok: false,
        err: new Error(
          'Listing text content already exists for rental object code: TEST123'
        ),
      })

      const res = await request(app.callback())
        .post('/listing-text-content')
        .send({
          rentalObjectCode: 'TEST123',
          contentBlocks: [{ type: 'text', content: 'test' }],
        })

      expect(res.status).toBe(409)
    })

    it('responds with 201 when creating with link blocks', async () => {
      const contentBlocksWithLinks = [
        { type: 'headline' as const, content: 'Test Headline' },
        {
          type: 'link' as const,
          name: 'Virtual Tour',
          url: 'https://example.com/tour',
        },
      ]
      const testData = factory.listingTextContent.build({
        contentBlocks: contentBlocksWithLinks,
      })
      jest.spyOn(listingTextContentAdapter, 'create').mockResolvedValueOnce({
        ok: true,
        data: testData,
      })

      const res = await request(app.callback())
        .post('/listing-text-content')
        .send({
          rentalObjectCode: testData.rentalObjectCode,
          contentBlocks: contentBlocksWithLinks,
        })

      expect(res.status).toBe(201)
      expect(res.body.content.contentBlocks).toEqual(contentBlocksWithLinks)
    })

    it('responds with 400 for invalid link URL in content block', async () => {
      const res = await request(app.callback())
        .post('/listing-text-content')
        .send({
          rentalObjectCode: 'TEST123',
          contentBlocks: [
            { type: 'text', content: 'test' },
            { type: 'link', name: 'Bad Link', url: 'not-a-valid-url' },
          ],
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Invalid request body')
    })

    it('responds with 400 for empty link name in content block', async () => {
      const res = await request(app.callback())
        .post('/listing-text-content')
        .send({
          rentalObjectCode: 'TEST123',
          contentBlocks: [
            { type: 'text', content: 'test' },
            { type: 'link', name: '', url: 'https://example.com' },
          ],
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Invalid request body')
    })
  })

  describe('PUT /listing-text-content/:rentalObjectCode', () => {
    it('responds with 200 on success', async () => {
      const testData = factory.listingTextContent.build()
      jest.spyOn(listingTextContentAdapter, 'update').mockResolvedValueOnce({
        ok: true,
        data: testData,
      })

      const res = await request(app.callback())
        .put(`/listing-text-content/${testData.rentalObjectCode}`)
        .send({
          contentBlocks: testData.contentBlocks,
        })

      expect(res.status).toBe(200)
      expect(res.body.content.rentalObjectCode).toBe(testData.rentalObjectCode)
    })

    it('responds with 400 for invalid body', async () => {
      const res = await request(app.callback())
        .put('/listing-text-content/TEST123')
        .send({
          contentBlocks: 'invalid',
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Invalid request body')
    })

    it('responds with 404 when not found', async () => {
      jest.spyOn(listingTextContentAdapter, 'update').mockResolvedValueOnce({
        ok: false,
        err: new Error(
          'Listing text content for rental object code NON_EXISTENT not found'
        ),
      })

      const res = await request(app.callback())
        .put('/listing-text-content/NON_EXISTENT')
        .send({
          contentBlocks: [{ type: 'text', content: 'test' }],
        })

      expect(res.status).toBe(404)
    })

    it('responds with 200 when updating with link blocks', async () => {
      const contentBlocksWithLinks = [
        { type: 'headline' as const, content: 'Updated Headline' },
        {
          type: 'link' as const,
          name: 'Updated Link',
          url: 'https://example.com/updated',
        },
      ]
      const testData = factory.listingTextContent.build({
        contentBlocks: contentBlocksWithLinks,
      })
      jest.spyOn(listingTextContentAdapter, 'update').mockResolvedValueOnce({
        ok: true,
        data: testData,
      })

      const res = await request(app.callback())
        .put(`/listing-text-content/${testData.rentalObjectCode}`)
        .send({
          contentBlocks: contentBlocksWithLinks,
        })

      expect(res.status).toBe(200)
      expect(res.body.content.contentBlocks).toEqual(contentBlocksWithLinks)
    })

    it('responds with 400 for invalid link URL in update', async () => {
      const res = await request(app.callback())
        .put('/listing-text-content/TEST123')
        .send({
          contentBlocks: [
            { type: 'link', name: 'Bad Link', url: 'invalid-url' },
          ],
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Invalid request body')
    })
  })

  describe('DELETE /listing-text-content/:rentalObjectCode', () => {
    it('responds with 200 on success', async () => {
      jest.spyOn(listingTextContentAdapter, 'remove').mockResolvedValueOnce({
        ok: true,
        data: undefined,
      })

      const res = await request(app.callback()).delete(
        '/listing-text-content/TEST123'
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toBeNull()
    })

    it('responds with 404 when not found', async () => {
      jest.spyOn(listingTextContentAdapter, 'remove').mockResolvedValueOnce({
        ok: false,
        err: new Error(
          'Listing text content for rental object code NON_EXISTENT not found'
        ),
      })

      const res = await request(app.callback()).delete(
        '/listing-text-content/NON_EXISTENT'
      )

      expect(res.status).toBe(404)
    })
  })
})
