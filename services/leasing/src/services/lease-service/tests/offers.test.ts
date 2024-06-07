jest.mock('onecore-utilities', () => {
  return {
    logger: {
      info: () => {
        return
      },
      error: () => {
        return
      },
    },
  }
})

import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { OfferStatus } from 'onecore-types'

import { routes } from '../offers'
import * as offerAdapter from '../adapters/offer-adapter'
import { OfferFactory } from './factory'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

describe('offers', () => {
  describe('POST /offer', () => {
    it('responds with 400 if request params are missing', async () => {
      const res = await request(app.callback()).post('/offer')
      expect(res.status).toBe(400)
    })

    it('responds with 400 if request params are invalid', async () => {
      const payload = {
        status: 'foo',
        listingId: 1,
        applicantId: 1,
        selectedApplicants: [],
        expiresAt: new Date().toISOString(),
      }

      const res = await request(app.callback()).post('/offer').send(payload)

      expect(res.status).toBe(400)
      expect(res.body.data).toEqual([
        {
          message: "Invalid enum value. Expected 1 | 2 | 3 | 4, received 'foo'",
          path: ['status'],
        },
      ])
    })

    it('creates an offer', async () => {
      const offer = OfferFactory.build()
      jest.spyOn(offerAdapter, 'create').mockResolvedValueOnce(offer)

      const payload = {
        status: OfferStatus.Active,
        listingId: 1,
        applicantId: 1,
        selectedApplicants: [],
        expiresAt: new Date().toISOString(),
      }

      const res = await request(app.callback()).post('/offer').send(payload)
      const expected = {
        ...offer,
        expiresAt: offer.expiresAt.toISOString(),
        createdAt: offer.createdAt.toISOString(),
      }

      expect(res.status).toBe(201)
      expect(res.body.data.createdAt).toBeDefined()
      expect(res.body.data.listingId).toEqual(expected.listingId)
      expect(res.body.data.expiresAt).toEqual(expected.expiresAt)
    })
  })
})
