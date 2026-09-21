// fetch is stable in Node.js 20 LTS but eslint-plugin-n still flags it as experimental
/* eslint-disable n/no-unsupported-features/node-builtins */
jest.mock('@onecore/utilities', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}))

const TEMPLATE_ID = 205000000099999

jest.mock('../adapters/infobip-template-ids', () => ({
  ...jest.requireActual('../adapters/infobip-template-ids'),
  LeaseTerminationConfirmationTemplateId: TEMPLATE_ID,
}))

jest.mock('../../../common/config', () => ({
  __esModule: true,
  default: {
    infobip: {
      baseUrl: 'https://infobip.test/',
      apiKey: 'test-api-key',
    },
  },
}))

import { sendLeaseTerminationConfirmation } from '../adapters/email-adapter'

const email = {
  to: 'tenant@example.com',
  contactCode: 'P123456',
  firstName: 'Anna',
  address: 'Testgatan 1',
  leaseId: '307-002-11-0201/11',
  endDate: new Date('2026-10-31'),
  rentalType: 'Bilplats' as const,
}

describe('sendLeaseTerminationConfirmation', () => {
  const fetchMock = jest.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock
  })

  it('posts to Infobip v4 with formatted placeholders', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ messageId: 'mid-term' }] }),
    })

    await sendLeaseTerminationConfirmation(email)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0] as [
      string,
      { method?: string; headers?: Record<string, string>; body?: string },
    ]
    expect(url).toBe('https://infobip.test/email/4/messages')
    expect(options.method).toBe('POST')
    expect(options.headers).toMatchObject({
      Authorization: 'App test-api-key',
      'Content-Type': 'application/json',
    })

    const body = JSON.parse(options.body as string)
    expect(body.messages[0].content.templateId).toBe(TEMPLATE_ID)
    const placeholders = JSON.parse(
      body.messages[0].destinations[0].to[0].placeholders
    )
    expect(placeholders).toEqual({
      firstName: 'Anna',
      address: 'Testgatan 1',
      leaseId: '307-002-11-0201/11',
      endDate: '2026-10-31',
      type: 'Bilplats',
    })
  })

  it('throws when Infobip responds with an error status', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'Bad Request',
    })

    await expect(sendLeaseTerminationConfirmation(email)).rejects.toThrow(
      'Infobip Email API error: 400'
    )
  })
})
