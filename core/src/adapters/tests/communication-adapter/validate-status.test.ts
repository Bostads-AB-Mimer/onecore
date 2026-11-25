import axios from 'axios'
jest.mock('@onecore/utilities', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  loggedAxios: axios,
  axiosTypes: axios,
}))

import nock from 'nock'

import config from '../../../common/config'
import {
  cancelDispatch,
  searchDispatches,
  sendBulkSms,
} from '../../communication-adapter'

// leasing-adapter sets this process-wide; the adapters must still treat 4xx
// as errors instead of resolving them as ok: true.
const originalValidateStatus = axios.defaults.validateStatus
beforeAll(() => {
  axios.defaults.validateStatus = (status) => status >= 200 && status < 500
})
afterAll(() => {
  axios.defaults.validateStatus = originalValidateStatus
})
afterEach(() => nock.cleanAll())

describe('communication adapters with the global <500 validateStatus', () => {
  it('sendBulkSms forwards the 400 reason', async () => {
    nock(config.communicationService.url)
      .post('/sendBulkSms')
      .reply(400, { reason: 'SEND_AT_IN_PAST' })

    const result = await sendBulkSms({
      phoneNumbers: ['0701234567'],
      text: 'x',
    })

    expect(result).toEqual({
      ok: false,
      err: 'SEND_AT_IN_PAST',
      statusCode: 400,
    })
  })

  it('cancelDispatch maps 409 to conflict', async () => {
    nock(config.communicationService.url)
      .post('/communication-log/dispatches/abc/cancel')
      .reply(409, { error: 'ALREADY_PROCESSED' })

    const result = await cancelDispatch('abc')

    expect(result).toEqual({ ok: false, err: 'conflict', statusCode: 409 })
  })

  it('searchDispatches returns ok: false on 400', async () => {
    nock(config.communicationService.url)
      .get('/communication-log/dispatches')
      .query(true)
      .reply(400, { error: 'Invalid query' })

    const result = await searchDispatches({ status: 'bogus' })

    expect(result).toEqual({ ok: false, err: 'error', statusCode: 400 })
  })
})
