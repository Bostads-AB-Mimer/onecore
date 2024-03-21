import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes } from '../index'
import * as xpandSoapAdapter from '../adapters/xpand-soap-adapter'
import {
  addApplicantToToWaitingList,
  getWaitingList,
} from '../adapters/xpand-soap-adapter'
import { WaitingList } from '../../../../../onecore-types'
import * as http from 'http'
import { HttpStatusCode } from 'axios'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

const mockedWaitingList: WaitingList[] = [
  {
    applicantCaption: 'Foo Bar',
    contactCode: 'P12345',
    contractFromApartment: new Date('2024-02-29T23:00:00.000Z'),
    queuePoints: 45,
    queuePointsSocialConnection: 0,
    waitingListFrom: new Date('2024-01-31T23:00:00.000Z'),
    waitingListTypeCaption: 'Bostad',
  },
  {
    applicantCaption: 'Foo Bar',
    contactCode: 'P12345',
    contractFromApartment: new Date('2024-02-29T23:00:00.000Z'),
    queuePoints: 45,
    queuePointsSocialConnection: 0,
    waitingListFrom: new Date('2024-01-31T23:00:00.000Z'),
    waitingListTypeCaption: 'Bilplats (intern)',
  },
]
describe('GET contact/waitingList', () => {
  it('should return success', async () => {
    const xpandAdapterSpy = jest
      .spyOn(xpandSoapAdapter, 'getWaitingList')
      .mockResolvedValue(mockedWaitingList)

    const result = await request(app.callback()).get('/contact/waitingList/123')

    expect(xpandAdapterSpy).toHaveBeenCalled()
    expect(result.status).toEqual(200)
  })

  it('handles errors', async () => {
    const xpandAdapterSpy = jest
      .spyOn(xpandSoapAdapter, 'getWaitingList')
      .mockImplementation(() => {
        throw new Error('Oh no')
      })

    const result = await request(app.callback()).get('/contact/waitingList/123')

    expect(xpandAdapterSpy).toHaveBeenCalled
    expect(result.status).toEqual(HttpStatusCode.InternalServerError)
    expect(result.body).toEqual({ error: 'Oh no' })
  })
})

describe('POST contact/waitingList', () => {
  it('should return success', async () => {
    const xpandAdapterSpy = jest
      .spyOn(xpandSoapAdapter, 'addApplicantToToWaitingList')
      .mockResolvedValue()

    const result = await request(app.callback()).post(
      '/contact/waitingList/123'
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

    const result = await request(app.callback()).post('/contact/waitingList/123')

    expect(xpandAdapterSpy).toHaveBeenCalled
    expect(result.status).toEqual(HttpStatusCode.InternalServerError)
    expect(result.body).toEqual({ error: 'Oh no' })
  })
})
