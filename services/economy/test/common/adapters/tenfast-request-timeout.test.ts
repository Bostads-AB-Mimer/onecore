import axios from 'axios'
import nock from 'nock'
import {
  makeTenfastRequest,
  TenfastTimeoutError,
  TENFAST_READ_TIMEOUT_MS,
} from '@src/common/adapters/tenfast/tenfast-adapter'

jest.mock('@src/common/config', () => ({
  tenfast: {
    baseUrl: 'https://test-api.tenfast.com',
    apiKey: 'test-api-key',
    companyId: 'test-hyresvard-id',
  },
}))

// Real axios against nock: the adapter tests mock axios, which can't show a
// request that never answers.
describe(makeTenfastRequest, () => {
  const tenfast = nock('https://test-api.tenfast.com')

  beforeAll(() => nock.disableNetConnect())
  afterEach(() => {
    nock.cleanAll()
    jest.restoreAllMocks()
  })
  afterAll(() => nock.enableNetConnect())

  it('fails a GET that never answers with TenfastTimeoutError', async () => {
    tenfast.get('/v1/hyresvard/hyror').delay(1_000).reply(200, {})

    const request = makeTenfastRequest('/v1/hyresvard/hyror', {
      timeoutMs: 50,
    })

    await expect(request).rejects.toThrow(TenfastTimeoutError)
    await expect(request).rejects.toThrow(
      'Tenfast GET /v1/hyresvard/hyror timed out after 50 ms'
    )
  })

  it('gives a GET the read timeout by default', async () => {
    const request = jest.spyOn(axios, 'request')
    tenfast.get('/v1/hyresvard/hyror').reply(200, {})

    await makeTenfastRequest('/v1/hyresvard/hyror')

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ timeout: TENFAST_READ_TIMEOUT_MS })
    )
  })

  it('leaves a write without a timeout', async () => {
    const request = jest.spyOn(axios, 'request')
    tenfast.post('/v1/hyresvard/transactions').reply(201, {})

    const response = await makeTenfastRequest('/v1/hyresvard/transactions', {
      method: 'POST',
      data: {},
    })

    expect(response.status).toBe(201)
    expect(request.mock.calls[0][0]).not.toHaveProperty('timeout')
  })

  it('passes other errors through unchanged', async () => {
    tenfast
      .get('/v1/hyresvard/hyror')
      .replyWithError({ code: 'ECONNRESET', message: 'socket hang up' })

    const err = await makeTenfastRequest('/v1/hyresvard/hyror').catch(
      (e: unknown) => e
    )

    expect(err).not.toBeInstanceOf(TenfastTimeoutError)
    expect(axios.isAxiosError(err) && err.code).toBe('ECONNRESET')
  })
})
