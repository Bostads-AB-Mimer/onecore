import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes } from '../index'
import * as leasingAdapter from '../../../adapters/leasing-adapter'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

const listingAreaTextContent = {
  id: '11111111-1111-1111-1111-111111111111',
  marketAreaCode: 'VAL',
  contentBlocks: [{ type: 'headline' as const, content: 'Vallby' }],
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
}

beforeEach(jest.resetAllMocks)

describe('GET /listing-area-text-content', () => {
  it('responds with 200 and a list of listing area text content', async () => {
    jest
      .spyOn(leasingAdapter, 'listListingAreaTextContent')
      .mockResolvedValueOnce({ ok: true, data: [listingAreaTextContent] })

    const res = await request(app.callback()).get('/listing-area-text-content')

    expect(res.status).toBe(200)
    expect(res.body.content).toHaveLength(1)
    expect(res.body.content[0]).toMatchObject({ marketAreaCode: 'VAL' })
  })

  it('responds with 500 if adapter fails', async () => {
    jest
      .spyOn(leasingAdapter, 'listListingAreaTextContent')
      .mockResolvedValueOnce({ ok: false, err: 'request-failed' })

    const res = await request(app.callback()).get('/listing-area-text-content')

    expect(res.status).toBe(500)
    expect(res.body).toMatchObject({ error: expect.any(String) })
  })
})

describe('GET /listing-area-text-content/:marketAreaCode', () => {
  it('responds with 200 and the listing area text content', async () => {
    jest
      .spyOn(leasingAdapter, 'getListingAreaTextContentByMarketAreaCode')
      .mockResolvedValueOnce({ ok: true, data: listingAreaTextContent })

    const res = await request(app.callback()).get(
      '/listing-area-text-content/VAL'
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toMatchObject({ marketAreaCode: 'VAL' })
  })

  it('responds with 404 when not found', async () => {
    jest
      .spyOn(leasingAdapter, 'getListingAreaTextContentByMarketAreaCode')
      .mockResolvedValueOnce({ ok: false, err: 'not-found' })

    const res = await request(app.callback()).get(
      '/listing-area-text-content/UNKNOWN'
    )

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ reason: expect.any(String) })
  })
})

describe('POST /listing-area-text-content', () => {
  const createRequest = {
    marketAreaCode: 'VAL',
    contentBlocks: [{ type: 'headline', content: 'Vallby' }],
  }

  it('responds with 201 and the created listing area text content', async () => {
    jest
      .spyOn(leasingAdapter, 'createListingAreaTextContent')
      .mockResolvedValueOnce({ ok: true, data: listingAreaTextContent })

    const res = await request(app.callback())
      .post('/listing-area-text-content')
      .send(createRequest)

    expect(res.status).toBe(201)
    expect(res.body.content).toMatchObject({ marketAreaCode: 'VAL' })
  })

  it('responds with 400 for an invalid request body', async () => {
    const spy = jest.spyOn(leasingAdapter, 'createListingAreaTextContent')

    const res = await request(app.callback())
      .post('/listing-area-text-content')
      .send({ marketAreaCode: 'VAL' })

    expect(res.status).toBe(400)
    expect(spy).not.toHaveBeenCalled()
  })

  it('responds with 409 on conflict', async () => {
    jest
      .spyOn(leasingAdapter, 'createListingAreaTextContent')
      .mockResolvedValueOnce({ ok: false, err: 'conflict' })

    const res = await request(app.callback())
      .post('/listing-area-text-content')
      .send(createRequest)

    expect(res.status).toBe(409)
    expect(res.body).toMatchObject({ reason: expect.any(String) })
  })
})

describe('PUT /listing-area-text-content/:marketAreaCode', () => {
  const updateRequest = {
    contentBlocks: [{ type: 'headline', content: 'Updated' }],
  }

  it('responds with 200 and the updated listing area text content', async () => {
    jest
      .spyOn(leasingAdapter, 'updateListingAreaTextContent')
      .mockResolvedValueOnce({ ok: true, data: listingAreaTextContent })

    const res = await request(app.callback())
      .put('/listing-area-text-content/VAL')
      .send(updateRequest)

    expect(res.status).toBe(200)
    expect(res.body.content).toMatchObject({ marketAreaCode: 'VAL' })
  })

  it('responds with 404 when not found', async () => {
    jest
      .spyOn(leasingAdapter, 'updateListingAreaTextContent')
      .mockResolvedValueOnce({ ok: false, err: 'not-found' })

    const res = await request(app.callback())
      .put('/listing-area-text-content/UNKNOWN')
      .send(updateRequest)

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ reason: expect.any(String) })
  })
})

describe('DELETE /listing-area-text-content/:marketAreaCode', () => {
  it('responds with 200 when deleted', async () => {
    jest
      .spyOn(leasingAdapter, 'deleteListingAreaTextContent')
      .mockResolvedValueOnce({ ok: true, data: undefined })

    const res = await request(app.callback()).delete(
      '/listing-area-text-content/VAL'
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toBeNull()
  })

  it('responds with 404 when not found', async () => {
    jest
      .spyOn(leasingAdapter, 'deleteListingAreaTextContent')
      .mockResolvedValueOnce({ ok: false, err: 'not-found' })

    const res = await request(app.callback()).delete(
      '/listing-area-text-content/UNKNOWN'
    )

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ reason: expect.any(String) })
  })
})
