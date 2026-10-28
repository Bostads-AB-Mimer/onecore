import { logger } from '@onecore/utilities'

import config from '../../common/config'
import { sendEmail } from '../../adapters/communication-adapter'

const SEND_TIMEOUT_MS = 30_000

export const notifyXpandSync = async (
  subject: string,
  body: string[]
): Promise<void> => {
  if (!config.emailAddresses.xpandSync) {
    logger.warn(
      { subject },
      'config.emailAddresses.xpandSync is not set — skipping notification'
    )
    return
  }
  try {
    await sendEmail(
      {
        to: config.emailAddresses.xpandSync,
        subject,
        body: body.join('\n'),
      },
      { timeoutMs: SEND_TIMEOUT_MS }
    )
  } catch (emailErr) {
    logger.error({ emailErr, subject }, 'failed to send notification')
  }
}
