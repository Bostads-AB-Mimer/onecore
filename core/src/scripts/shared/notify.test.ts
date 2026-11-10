import config from '../../common/config'
import * as communicationAdapter from '../../adapters/communication-adapter'
import { notifyEconomy, notifyXpandSync } from './notify'

const originalXpandSync = config.emailAddresses.xpandSync
const originalEconomy = config.emailAddresses.economy

let sendEmailSpy: jest.SpyInstance

beforeEach(() => {
  ;(config.emailAddresses as Record<string, string>).xpandSync =
    'sync@example.com'
  sendEmailSpy = jest
    .spyOn(communicationAdapter, 'sendEmail')
    .mockResolvedValue({ ok: true, data: null })
})

afterEach(() => {
  ;(config.emailAddresses as Record<string, string>).xpandSync =
    originalXpandSync
  ;(config.emailAddresses as Record<string, string>).economy = originalEconomy
  jest.restoreAllMocks()
})

describe('notifyXpandSync', () => {
  it('sends the body lines joined by newlines to the xpandSync address', async () => {
    await notifyXpandSync('subject', ['one', 'two'])

    expect(sendEmailSpy).toHaveBeenCalledWith(
      {
        to: 'sync@example.com',
        subject: 'subject',
        body: 'one\ntwo',
      },
      { timeoutMs: 30_000 }
    )
  })

  it('sends nothing when no address is configured', async () => {
    ;(config.emailAddresses as Record<string, string>).xpandSync = ''

    await notifyXpandSync('subject', ['one'])

    expect(sendEmailSpy).not.toHaveBeenCalled()
  })

  it('does not throw when sending fails', async () => {
    sendEmailSpy.mockRejectedValue(new Error('smtp down'))

    await expect(notifyXpandSync('subject', ['one'])).resolves.toBeUndefined()
  })
})

describe('notifyEconomy', () => {
  it('sends to the economy address', async () => {
    ;(config.emailAddresses as Record<string, string>).economy =
      'economy@example.com'

    await notifyEconomy('subject', ['one'])

    expect(sendEmailSpy).toHaveBeenCalledWith(
      { to: 'economy@example.com', subject: 'subject', body: 'one' },
      { timeoutMs: 30_000 }
    )
  })

  it('does not throw when the communication service rejects the email', async () => {
    ;(config.emailAddresses as Record<string, string>).economy =
      'economy@example.com'
    sendEmailSpy.mockResolvedValue({ ok: false, err: 'error', statusCode: 500 })

    await expect(notifyEconomy('subject', ['one'])).resolves.toBeUndefined()
  })
})
