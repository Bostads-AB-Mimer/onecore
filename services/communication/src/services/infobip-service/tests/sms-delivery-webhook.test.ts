import { sendBulkSms, sendWorkOrderSms } from '../adapters/sms-adapter'
import config from '../../../common/config'

jest.mock('../../../common/config', () => ({
  __esModule: true,
  default: {
    tele2: { baseUrl: 'https://api.tele2messaging.com', apiKey: 'key' },
    infobip: {
      smsDeliveryReportUrl: 'https://host/webhooks/infobip',
      webhookToken: 'tok',
    },
  },
}))

jest.mock('@onecore/utilities', () => ({
  logger: { info: () => {}, error: () => {}, warn: () => {} },
}))

// Same object reference the adapter reads — mutate it to toggle config per-test.
const mockConfig = config as unknown as {
  infobip: { smsDeliveryReportUrl: string; webhookToken: string }
}

const okResponse = {
  ok: true,
  json: async () => ({
    messages: [{ to: '46701234567', messageId: 'm1', status: {} }],
  }),
}

function lastSentBody() {
  const call = (global.fetch as jest.Mock).mock.calls.at(-1)
  return JSON.parse((call?.[1] as { body: string }).body)
}

beforeEach(() => {
  mockConfig.infobip.smsDeliveryReportUrl = 'https://host/webhooks/infobip'
  mockConfig.infobip.webhookToken = 'tok'
  global.fetch = jest
    .fn()
    .mockResolvedValue(okResponse) as unknown as typeof fetch
})

describe('SMS per-message delivery webhook', () => {
  it('attaches the delivery webhook (with token) for bulk sends', async () => {
    await sendBulkSms({ phoneNumbers: ['46701234567'], text: 'hi' })

    const msg = lastSentBody().messages[0]
    expect(msg.webhooks.delivery.url).toBe(
      'https://host/webhooks/infobip?token=tok'
    )
    expect(msg.webhooks.contentType).toBe('application/json')
  })

  it('does NOT attach a webhook for non-logged sends (work order)', async () => {
    await sendWorkOrderSms({ phoneNumber: '46701234567', text: 'hi' })

    expect(lastSentBody().messages[0].webhooks).toBeUndefined()
  })

  it('skips the webhook when the report URL is set but the token is missing', async () => {
    mockConfig.infobip.webhookToken = ''

    await sendBulkSms({ phoneNumbers: ['46701234567'], text: 'hi' })

    expect(lastSentBody().messages[0].webhooks).toBeUndefined()
  })
})
