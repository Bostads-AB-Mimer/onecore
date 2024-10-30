import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes } from '../index'
import * as xpandSoapAdapter from '../adapters/xpand/xpand-soap-adapter'
import { HttpStatusCode } from 'axios'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

describe('POST contacts/1234567890/waitingList', () => {
  it('should return success', async () => {
    const xpandAdapterSpy = jest
      .spyOn(xpandSoapAdapter, 'addApplicantToToWaitingList')
      .mockResolvedValue()

    const result = await request(app.callback()).post(
      '/contacts/1234567890/waitingLists'
    )

    expect(xpandAdapterSpy).toHaveBeenCalled()
    expect(result.status).toEqual(201)
  })

  it('handles errors', async () => {
    const xpandAdapterSpy = jest
      .spyOn(xpandSoapAdapter, 'addApplicantToToWaitingList')
      .mockImplementation(() => {
        throw new Error('Oh no')
      })

    const result = await request(app.callback()).post(
      '/contacts/1234567890/waitingLists'
    )

    expect(xpandAdapterSpy).toHaveBeenCalled()
    expect(result.status).toEqual(HttpStatusCode.InternalServerError)
    expect(result.body).toEqual({ error: 'Oh no' })
  })
})
