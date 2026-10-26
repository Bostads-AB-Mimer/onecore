import axios from 'axios'
jest.mock('@onecore/utilities', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  loggedAxios: axios,
  axiosTypes: axios,
}))

import nock from 'nock'

import config from '../../../common/config'
import { sendEmail } from '../../communication-adapter'

const email = { to: 'team@example.com', subject: 'Ämne', body: 'Text' }

afterEach(() => {
  nock.cleanAll()
  jest.restoreAllMocks()
})

describe('sendEmail', () => {
  it('returns ok:true when communication service responds 200', async () => {
    nock(config.communicationService.url)
      .post('/send-email')
      .reply(200, { content: { messageId: 'abc' } })

    const result = await sendEmail(email)

    expect(result).toEqual({ ok: true, data: { messageId: 'abc' } })
  })

  it('bounds the call so a hung mail service fails within a few minutes', async () => {
    const postFormSpy = jest
      .spyOn(axios, 'postForm')
      .mockResolvedValue({ status: 200, data: { content: {} } })

    await sendEmail(email)

    const timeout = postFormSpy.mock.calls[0][2]?.timeout
    expect(timeout).toBeGreaterThan(0)
    expect(timeout).toBeLessThanOrEqual(5 * 60_000)
  })
})
