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
    generateRouteMetadata: jest.fn(() => ({})),
  }
})

import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes } from '../../routes/contacts'
import * as tenantLeaseAdapter from '../../adapters/xpand/tenant-lease-adapter'
import * as xPandSoapAdapter from '../../adapters/xpand/xpand-soap-adapter'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

jest.mock('axios')

describe('GET /contacts/search', () => {
  it('responds with 400 if query param is missing', async () => {
    const res = await request(app.callback()).get('/contacts/search')
    expect(res.status).toBe(400)
  })

  it('responds with 500 if error', async () => {
    jest
      .spyOn(tenantLeaseAdapter, 'getContactsDataBySearchQuery')
      .mockResolvedValueOnce({ ok: false, err: 'internal-error' })

    const res = await request(app.callback()).get('/contacts/search?q=foo')
    expect(res.status).toBe(500)
  })

  it('returns a list of contact data', async () => {
    jest
      .spyOn(tenantLeaseAdapter, 'getContactsDataBySearchQuery')
      .mockResolvedValueOnce({
        ok: true,
        data: [{ contactCode: 'foo', fullName: 'Foo Bar' }],
      })

    const res = await request(app.callback()).get('/contacts/search?q=foo')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      content: expect.arrayContaining([
        expect.objectContaining({ contactCode: 'foo', fullName: 'Foo Bar' }),
      ]),
    })
  })

  describe('POST /contact/waitingList/:nationalRegistrationNumber/reset', () => {
    it('responds with 200 and a message upon success', async () => {
      jest
        .spyOn(xPandSoapAdapter, 'removeApplicantFromWaitingList')
        .mockResolvedValue({ ok: true, data: undefined })
      jest
        .spyOn(xPandSoapAdapter, 'addApplicantToToWaitingList')
        .mockResolvedValue()

      const res = await request(app.callback())
        .post('/contact/waitingList/1234567890/reset')
        .send({
          contactCode: '123',
          waitingListTypeCaption: 'Bilplatser (intern)',
        })

      expect(res.status).toBe(200)
      expect(res.body).toEqual({
        content: {
          message: 'Waiting List time successfullt reset for applicant',
        },
      })
    })

    it('returns status 404 upon not-in-waiting-list error from removeApplicantFromWaitingList', async () => {
      jest
        .spyOn(xPandSoapAdapter, 'removeApplicantFromWaitingList')
        .mockResolvedValue({ ok: false, err: 'not-in-waiting-list' })
      jest
        .spyOn(xPandSoapAdapter, 'addApplicantToToWaitingList')
        .mockResolvedValue()

      const res = await request(app.callback())
        .post('/contact/waitingList/1234567890/reset')
        .send({
          contactCode: '123',
          waitingListTypeCaption: 'Bilplatser (intern)',
        })

      expect(res.status).toBe(404)
      expect(res.body).toEqual({
        error: 'Contact Not In Waiting List',
      })
    })

    it('returns status 500 upon unknown error from removeApplicantFromWaitingList', async () => {
      jest
        .spyOn(xPandSoapAdapter, 'removeApplicantFromWaitingList')
        .mockResolvedValue({ ok: false, err: 'unknown' })
      jest
        .spyOn(xPandSoapAdapter, 'addApplicantToToWaitingList')
        .mockResolvedValue()

      const res = await request(app.callback())
        .post('/contact/waitingList/1234567890/reset')
        .send({
          contactCode: '123',
          waitingListTypeCaption: 'Bilplatser (intern)',
        })

      expect(res.status).toBe(500)
      expect(res.body).toEqual({
        error: 'Unknown error',
      })
    })

    it('returns status 500 upon unknown error from addApplicantToToWaitingList', async () => {
      jest
        .spyOn(xPandSoapAdapter, 'removeApplicantFromWaitingList')
        .mockResolvedValue({ ok: true, data: undefined })
      jest
        .spyOn(xPandSoapAdapter, 'addApplicantToToWaitingList')
        .mockImplementation(() => {
          throw new Error('Noooo fel')
        })

      const res = await request(app.callback())
        .post('/contact/waitingList/1234567890/reset')
        .send({
          contactCode: '123',
          waitingListTypeCaption: 'Bilplatser (intern)',
        })

      expect(res.status).toBe(500)
      expect(res.body).toEqual({
        error: 'Noooo fel',
      })
    })
  })
})
