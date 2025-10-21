import { Infobip, AuthType } from '@infobip-api/sdk'
import config from '../config'
import { logger } from '@onecore/utilities'

// NOTE: Notifications done this way should be refactored into using the communications microservice, which would
// require also refactoring the scripts to be invoked from core
const infobip = new Infobip({
  baseUrl: config.infobip.baseUrl,
  apiKey: config.infobip.apiKey,
  authType: AuthType.ApiKey,
})

export const sendEmail = async (
  recipient: string,
  subject: string,
<<<<<<< HEAD
  body: string,
  attachments?: any[]
=======
  body: string
>>>>>>> 1e48dfd6 (EKO-41: Invoice events (#100) (#101))
) => {
  logger.info({ to: recipient, subject: subject }, 'Sending email')

  try {
<<<<<<< HEAD
    const recipients = recipient.split(';')

    for (const to of recipients) {
      const response = await infobip.channels.email.send({
        to,
        from: 'Bostads Mimer AB <noreply@mimer.nu>',
        subject: subject,
        text: body,
        attachment: attachments,
      })
      if (response.status === 200) {
        logger.info({ to, subject: subject }, 'Sending email complete')
      } else {
        throw new Error(response.body)
      }
=======
    const response = await infobip.channels.email.send({
      to: recipient.split(';'),
      from: 'Bostads Mimer AB <noreply@mimer.nu>',
      subject: subject,
      text: body,
    })
    if (response.status === 200) {
      logger.info({ to: recipient, subject: subject }, 'Sending email complete')
      return response.data
    } else {
      throw new Error(response.body)
>>>>>>> 1e48dfd6 (EKO-41: Invoice events (#100) (#101))
    }
  } catch (error) {
    logger.error(error, 'Could not send email')
    throw error
  }
}
