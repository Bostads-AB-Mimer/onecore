import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { makeOkapiRouter } from 'koa-okapi-router'

import { routes } from '../index'
import { searchDispatches, getDispatchRecipients } from '../adapters/db'

jest.mock('@onecore/utilities', () => ({
  logger: { info() {}, error() {}, warn() {} },
}))

jest.mock('../adapters/db', () => ({
  searchDispatches: jest.fn(),
  getDispatchRecipients: jest.fn(),
  getDispatchById: jest.fn(),
  cancelScheduledRecipients: jest.fn(),
  updateDispatchSendAt: jest.fn(),
  getCustomerMessages: jest.fn(),
  logOutboundDispatch: jest.fn(),
}))

const searchMock = searchDispatches as jest.Mock
const recipientsMock = getDispatchRecipients as jest.Mock

const app = new Koa()
const okapi = makeOkapiRouter(new KoaRouter(), {
  openapi: { info: { title: 'test' } },
})
routes(okapi)
app.use(bodyParser())
app.use(okapi.routes())

const emptyPage = {
  content: [],
  _meta: { totalRecords: 0, page: 1, limit: 20, count: 0 },
  _links: [],
}

beforeEach(() => {
  searchMock.mockReset()
  recipientsMock.mockReset()
  searchMock.mockResolvedValue(emptyPage)
  recipientsMock.mockResolvedValue(emptyPage)
})

describe('GET /communication-log/dispatches', () => {
  it('returns 200 and passes parsed filters to the adapter', async () => {
    const res = await request(app.callback())
      .get('/communication-log/dispatches')
      .query({ channel: 'sms', q: 'hyra', audienceBuildingCodes: 'B12' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual(emptyPage)
    const passed = searchMock.mock.calls[0][0]
    expect(passed.channel).toEqual(['sms'])
    expect(passed.q).toBe('hyra')
    expect(passed.audienceBuildingCodes).toEqual(['B12'])
  })

  it('parses the picker-level audience params (kvv-area, property)', async () => {
    const res = await request(app.callback())
      .get('/communication-log/dispatches')
      .query({
        audienceKvvAreaCodes: '61116',
        audienceProperty: ['ÄLGEN 3', 'MINKEN 2'],
        audienceParkingAreaCodes: '504-717-00',
        audienceStaircaseCodes: '504-017-01',
      })

    expect(res.status).toBe(200)
    const passed = searchMock.mock.calls[0][0]
    expect(passed.audienceKvvAreaCodes).toEqual(['61116'])
    expect(passed.audienceProperty).toEqual(['ÄLGEN 3', 'MINKEN 2'])
    expect(passed.audienceParkingAreaCodes).toEqual(['504-717-00'])
    expect(passed.audienceStaircaseCodes).toEqual(['504-017-01'])
  })

  it('parses audienceObjectTypes', async () => {
    const res = await request(app.callback())
      .get('/communication-log/dispatches')
      .query({ audienceObjectTypes: ['parkingSpace', 'facility'] })

    expect(res.status).toBe(200)
    const passed = searchMock.mock.calls[0][0]
    expect(passed.audienceObjectTypes).toEqual(['parkingSpace', 'facility'])
  })

  it('returns 400 on an unknown object type', async () => {
    const res = await request(app.callback())
      .get('/communication-log/dispatches')
      .query({ audienceObjectTypes: 'garage' })

    expect(res.status).toBe(400)
    expect(searchMock).not.toHaveBeenCalled()
  })

  it('returns 400 on an invalid filter value', async () => {
    const res = await request(app.callback())
      .get('/communication-log/dispatches')
      .query({ sortBy: 'not-a-column' })

    expect(res.status).toBe(400)
    expect(searchMock).not.toHaveBeenCalled()
  })
})

describe('GET /communication-log/dispatches/:id/recipients', () => {
  const id = '5a748f19-fca0-4562-9f8d-05eb0e16d076'

  it('returns 200 and forwards status/q filters', async () => {
    const res = await request(app.callback())
      .get(`/communication-log/dispatches/${id}/recipients`)
      .query({ status: 'delivered', q: '46701' })

    expect(res.status).toBe(200)
    expect(recipientsMock).toHaveBeenCalledWith(
      id,
      { status: ['delivered'], q: '46701' },
      expect.anything()
    )
  })
})
