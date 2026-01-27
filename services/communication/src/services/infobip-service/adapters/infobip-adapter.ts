import { Infobip, AuthType } from '@infobip-api/sdk'
import config from '../../../common/config'
import { logger } from '@onecore/utilities'

const infobip = new Infobip({
  baseUrl: config.infobip.baseUrl,
  apiKey: config.infobip.apiKey,
  authType: AuthType.ApiKey,
})

// Deprecated, should update sendEmail in email-adapter to handle attachments
export const sendEmailInfobipSdk = async (
  to: string,
  subject: string,
  body: string,
  attachments?: { data: Buffer; name: string }[]
) => {
  logger.info({ to: to, subject: subject }, 'Sending email')
  const recipients = to.split(';')

  for (const to of recipients) {
    const infobipOptions = {
      to,
      from: 'Bostads Mimer AB <noreply@mimer.nu>',
      subject: subject,
      text: body,
      attachment: attachments,
    }

    const response = await infobip.channels.email.send(infobipOptions)
    if (response.status === 200) {
      logger.info({ to, subject: subject }, 'Sending email complete')
      return response.data
    } else {
      logger.error(response, 'Error sending email')
      throw new Error(response.body)
    }
  }
}
