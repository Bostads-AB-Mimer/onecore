import { Infobip, AuthType } from '@infobip-api/sdk'
import config from '../../../common/config'
import { Email } from 'onecore-types'

const infobip = new Infobip({
  baseUrl: config.infobip.baseUrl,
  apiKey: config.infobip.apiKey,
  authType: AuthType.ApiKey,
})

export const sendEmail = async (message: Email) => {
  try {
    const response = await infobip.channels.email.send({
      to: message.to,
      from: 'noreply@mimer.nu',
      subject: message.subject,
      text: message.text,
    })
    if (response.status === 200) {
      return response.data
    } else {
      throw new Error(response.body)
    }
  } catch (error) {
    console.error(error)
    throw error
  }
}
