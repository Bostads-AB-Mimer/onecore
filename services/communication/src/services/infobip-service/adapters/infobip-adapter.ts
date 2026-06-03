import { Infobip, AuthType } from '@infobip-api/sdk'
import { InspectionProtocolEmail } from '@onecore/types'
import config from '../../../common/config'
import { logger } from '@onecore/utilities'

const EMAIL_SENDER = 'Bostads Mimer AB <noreply@mimer.nu>'
const InspectionProtocolEmailTemplateId = 205000000035322

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
  const result: { sent: string[]; errors: string[] } = {
    sent: [],
    errors: [],
  }

  for (const to of recipients) {
    const infobipOptions = {
      to,
      from: EMAIL_SENDER,
      subject: subject,
      text: body,
      attachment: attachments,
    }

    const response = await infobip.channels.email.send(infobipOptions)

    if (response.status === 200) {
      logger.info({ to, subject: subject }, 'Sending email complete')
      result.sent.push(to)
    } else {
      result.errors.push(to)
      logger.error(response, 'Error sending email')
      throw new Error(response.body)
    }
  }

  return result
}

export const sendInspectionProtocolEmail = async (
  email: InspectionProtocolEmail
) => {
  logger.info(
    { to: email.to, subject: email.subject },
    'Sending inspection protocol email'
  )

  const attachment = email.attachments?.map((att) => ({
    data: Buffer.from(att.content, 'base64'),
    name: att.filename,
  }))

  const response = await infobip.channels.email.send({
    to: email.to,
    from: EMAIL_SENDER,
    templateId: InspectionProtocolEmailTemplateId,
    defaultPlaceholders: JSON.stringify({ firstName: email.firstName }),
    attachment,
  })

  if (response.status !== 200) {
    logger.error(
      { status: response.status, body: response.body, to: email.to },
      'Error sending inspection protocol email'
    )
    throw new Error(
      `Infobip Email API error: ${response.status} - ${JSON.stringify(response.body)}`
    )
  }

  logger.info({ to: email.to }, 'Sending inspection protocol email complete')
  return { data: response.data ?? response.body }
}
