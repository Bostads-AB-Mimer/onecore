import { errorMessage, logger } from '@onecore/utilities'

import config from '../../common/config'
import { sendEmail } from '../../adapters/communication-adapter'

const SEND_TIMEOUT_MS = 30_000

type NotificationAddress = keyof typeof config.emailAddresses

const notify = async (
  address: NotificationAddress,
  subject: string,
  body: string[]
): Promise<void> => {
  const to = config.emailAddresses[address]
  if (!to) {
    logger.warn(
      { subject },
      `config.emailAddresses.${address} is not set — skipping notification`
    )
    return
  }

  try {
    const result = await sendEmail(
      { to, subject, body: body.join('\n') },
      { timeoutMs: SEND_TIMEOUT_MS }
    )
    if (!result.ok) {
      logger.error(
        { subject, status: result.statusCode },
        'failed to send notification'
      )
    }
  } catch (err: unknown) {
    logger.error(
      { subject, error: errorMessage(err) },
      'failed to send notification'
    )
  }
}

export const notifyXpandSync = (subject: string, body: string[]) =>
  notify('xpandSync', subject, body)

export const notifyEconomy = (subject: string, body: string[]) =>
  notify('economy', subject, body)
