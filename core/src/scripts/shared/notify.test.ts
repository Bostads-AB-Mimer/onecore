import config from '../../common/config'
import * as communicationAdapter from '../../adapters/communication-adapter'
import { notifyXpandSync } from './notify'

const originalXpandSync = config.emailAddresses.xpandSync

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
