import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes } from '../../routes/listing-area-text-content'
import listingAreaTextContentAdapter from '../../adapters/listing-area-text-content-adapter'
import * as factory from '../factories'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

beforeEach(jest.restoreAllMocks)

describe('listing-area-text-content routes', () => {
  describe('GET /listing-area-text-content', () => {
    it('responds with 200 and a list of content', async () => {
      const testData = [
        factory.listingAreaTextContent.build(),
        factory.listingAreaTextContent.build(),
      ]
      jest
        .spyOn(listingAreaTextContentAdapter, 'list')
        .mockResolvedValueOnce(testData)

      const res = await request(app.callback()).get(
        '/listing-area-text-content'
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveLength(2)
      expect(res.body.content[0].marketAreaCode).toBe(
        testData[0].marketAreaCode
      )
    })

    it('responds with 500 when the adapter throws', async () => {
      jest
        .spyOn(listingAreaTextContentAdapter, 'list')
        .mockRejectedValueOnce(new Error('DB connection failed'))

      const res = await request(app.callback()).get(
        '/listing-area-text-content'
      )

      expect(res.status).toBe(500)
    })
  })

  describe('GET /listing-area-text-content/:marketAreaCode', () => {
    it('responds with 200 and content when found', async () => {
      const testData = factory.listingAreaTextContent.build()
      jest
        .spyOn(listingAreaTextContentAdapter, 'getByMarketAreaCode')
        .mockResolvedValueOnce(testData)

      const res = await request(app.callback()).get(
        `/listing-area-text-content/${testData.marketAreaCode}`
      )

      expect(res.status).toBe(200)
      expect(res.body.content.marketAreaCode).toBe(testData.marketAreaCode)
      expect(res.body.content.contentBlocks).toEqual(testData.contentBlocks)
    })

    it('responds with 404 when not found', async () => {
      jest
        .spyOn(listingAreaTextContentAdapter, 'getByMarketAreaCode')
        .mockResolvedValueOnce(undefined)

      const res = await request(app.callback()).get(
        '/listing-area-text-content/NON_EXISTENT'
      )

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('Listing area text content not found')
    })

    it('responds with 500 when the adapter throws', async () => {
      jest
        .spyOn(listingAreaTextContentAdapter, 'getByMarketAreaCode')
        .mockRejectedValueOnce(new Error('DB connection failed'))

      const res = await request(app.callback()).get(
        '/listing-area-text-content/VAL'
      )

      expect(res.status).toBe(500)
    })
  })

  describe('POST /listing-area-text-content', () => {
    it('responds with 201 on success', async () => {
      const testData = factory.listingAreaTextContent.build()
      jest
        .spyOn(listingAreaTextContentAdapter, 'create')
        .mockResolvedValueOnce({
          ok: true,
          data: testData,
        })

      const res = await request(app.callback())
        .post('/listing-area-text-content')
        .send({
          marketAreaCode: testData.marketAreaCode,
          contentBlocks: testData.contentBlocks,
        })

      expect(res.status).toBe(201)
      expect(res.body.content.marketAreaCode).toBe(testData.marketAreaCode)
    })

    it('responds with 400 for invalid body', async () => {
      const res = await request(app.callback())
        .post('/listing-area-text-content')
        .send({
          // Missing required fields
          contentBlocks: 'invalid',
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Invalid request body')
    })

    it('responds with 400 for invalid content block type', async () => {
      const res = await request(app.callback())
        .post('/listing-area-text-content')
        .send({
          marketAreaCode: 'VAL',
          contentBlocks: [{ type: 'invalid_type', content: 'test' }],
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Invalid request body')
    })

    it('responds with 400 for invalid link url in content block', async () => {
      const res = await request(app.callback())
        .post('/listing-area-text-content')
        .send({
          marketAreaCode: 'VAL',
          contentBlocks: [
            { type: 'text', content: 'test' },
            { type: 'link', name: 'Bad Link', url: 'not-a-valid-url' },
          ],
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Invalid request body')
    })

    it('responds with 409 for duplicate market area code', async () => {
      jest
        .spyOn(listingAreaTextContentAdapter, 'create')
        .mockResolvedValueOnce({
          ok: false,
          err: new Error(
            'Listing area text content already exists for market area code: VAL'
          ),
        })

      const res = await request(app.callback())
        .post('/listing-area-text-content')
        .send({
          marketAreaCode: 'VAL',
          contentBlocks: [{ type: 'text', content: 'test' }],
        })

      expect(res.status).toBe(409)
    })

    it('responds with 500 on unexpected adapter error', async () => {
      jest
        .spyOn(listingAreaTextContentAdapter, 'create')
        .mockResolvedValueOnce({
          ok: false,
          err: new Error('Something went wrong'),
        })

      const res = await request(app.callback())
        .post('/listing-area-text-content')
        .send({
          marketAreaCode: 'VAL',
          contentBlocks: [{ type: 'text', content: 'test' }],
        })

      expect(res.status).toBe(500)
    })
  })

  describe('PUT /listing-area-text-content/:marketAreaCode', () => {
    it('responds with 200 on success', async () => {
      const testData = factory.listingAreaTextContent.build()
      jest
        .spyOn(listingAreaTextContentAdapter, 'update')
        .mockResolvedValueOnce({
          ok: true,
          data: testData,
        })

      const res = await request(app.callback())
        .put(`/listing-area-text-content/${testData.marketAreaCode}`)
        .send({
          contentBlocks: testData.contentBlocks,
        })

      expect(res.status).toBe(200)
      expect(res.body.content.marketAreaCode).toBe(testData.marketAreaCode)
    })

    it('responds with 400 for invalid body', async () => {
      const res = await request(app.callback())
        .put('/listing-area-text-content/VAL')
        .send({
          contentBlocks: 'invalid',
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Invalid request body')
    })

    it('responds with 404 when not found', async () => {
      jest
        .spyOn(listingAreaTextContentAdapter, 'update')
        .mockResolvedValueOnce({
          ok: false,
          err: new Error(
            'Listing area text content for market area code NON_EXISTENT not found'
          ),
        })

      const res = await request(app.callback())
        .put('/listing-area-text-content/NON_EXISTENT')
        .send({
          contentBlocks: [{ type: 'text', content: 'test' }],
        })

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /listing-area-text-content/:marketAreaCode', () => {
    it('responds with 200 on success', async () => {
      jest
        .spyOn(listingAreaTextContentAdapter, 'remove')
        .mockResolvedValueOnce({
          ok: true,
          data: undefined,
        })

      const res = await request(app.callback()).delete(
        '/listing-area-text-content/VAL'
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toBeNull()
    })

    it('responds with 404 when not found', async () => {
      jest
        .spyOn(listingAreaTextContentAdapter, 'remove')
        .mockResolvedValueOnce({
          ok: false,
          err: new Error(
            'Listing area text content for market area code NON_EXISTENT not found'
          ),
        })

      const res = await request(app.callback()).delete(
        '/listing-area-text-content/NON_EXISTENT'
      )

      expect(res.status).toBe(404)
    })
  })
})
