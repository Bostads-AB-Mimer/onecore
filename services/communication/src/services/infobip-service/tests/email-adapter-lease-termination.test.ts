jest.mock('@onecore/utilities', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}))

jest.mock('../../../common/config', () => {
  const actual = jest.requireActual('../../../common/config').default
  return {
    __esModule: true,
    default: {
      ...actual,
      infobip: { baseUrl: 'https://infobip.test/', apiKey: 'test-api-key' },
    },
  }
})

jest.mock('../../template-service/adapters/db', () => ({
  getSystemTemplate: jest.fn().mockResolvedValue({
    systemKey: 'lease_termination_confirmation',
    subject: 'Uppsägning {{leaseId}}',
    body: '{{tenantNames}}, sista dag {{endDate}}',
  }),
}))

import { sendLeaseTerminationConfirmation } from '../adapters/email-adapter'
import { ProviderResponseError } from '../adapters/provider-error'

const tenant = {
  contactCode: 'P123456',
  fullName: 'Anna Andersson',
  birthDate: '1985-03-14',
  street: 'Storgatan 1',
  zipCode: '722 11',
  city: 'Västerås',
}

const email = {
  to: 'tenant@example.com',
  contactCode: 'P123456',
  firstName: 'Anna',
  leaseId: '307-002-11-0201/11',
  endDate: new Date('2026-10-31'),
  rentalType: 'Bilplats' as const,
  lastName: 'Andersson',
  preferredMoveOutDate: '2026-10-15',
  rentalObjectAddress: 'Bilvägen 3',
  tenants: [tenant],
}

describe('sendLeaseTerminationConfirmation', () => {
  const fetchMock = jest.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock
  })

  it('posts the rendered confirmation to Infobip v4', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ messageId: 'mid-term' }] }),
    })

    const result = await sendLeaseTerminationConfirmation(email)

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

    const message = JSON.parse(options.body as string).messages[0]
    expect(message.content.subject).toBe('Uppsägning 307-002-11-0201/11')
    // Lease termination has no footer, so the text is just the body.
    expect(message.content.text).toBe('Anna Andersson, sista dag 2026-10-31')
    expect(message.content.html).toContain(
      'Anna Andersson, sista dag 2026-10-31'
    )
    expect(message.destinations[0].to[0]).toEqual({
      destination: 'tenant@example.com',
    })
    expect(result.rendered.text).toBe(message.content.text)
  })

  it('lists both holders of a two-holder lease', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) })

    const result = await sendLeaseTerminationConfirmation({
      ...email,
      tenants: [tenant, { ...tenant, contactCode: 'P2', fullName: 'Bo Berg' }],
    })

    expect(result.rendered.text).toContain('Anna Andersson, Bo Berg')
  })

  it('throws a ProviderResponseError when Infobip rejects the send', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'Bad Request',
    })

    await expect(
      sendLeaseTerminationConfirmation(email)
    ).rejects.toBeInstanceOf(ProviderResponseError)
  })
})
