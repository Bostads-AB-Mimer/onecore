import { loggedAxios as axios } from 'onecore-utilities'
import config from '../common/config'
import { Contact } from 'onecore-types'
import { logger } from 'onecore-utilities'

export const sendNotificationToContact = async (
  recipientContact: Contact,
  subject: string,
  message: string
) => {
  try {
    const axiosOptions = {
      method: 'POST',
      data: {
        to:
          process.env.NODE_ENV === 'production'
            ? recipientContact.emailAddress
            : config.emailAddresses.tenantDefault,
        subject,
        text: message,
      },
      headers: {
        'Content-type': 'application/json',
      },
    }

    const result = await axios(
      `${config.communicationService.url}/sendMessage`,
      axiosOptions
    )

    return result.data
  } catch (error) {
    logger.error(
      error,
      `Error sending notification to contact ${recipientContact.contactCode}`
    )
  }
}

export const sendNotificationToRole = async (
  recipientRole: string,
  subject: string,
  message: string
) => {
  try {
    const recipientEmailAddress = (
      config.emailAddresses as Record<string, string>
    )[recipientRole]

    if (!recipientEmailAddress) {
      throw new Error(
        `Error sending notification to ${recipientRole}. No email address specified for role.`
      )
    }

    const axiosOptions = {
      method: 'POST',
      data: {
        to: recipientEmailAddress,
        subject,
        text: message,
      },
      headers: {
        'Content-type': 'application/json',
      },
    }

    const result = await axios(
      `${config.communicationService.url}/sendMessage`,
      axiosOptions
    )

    return result.data
  } catch (error) {
    logger.error(error, `Error sending notification to role ${recipientRole}`)
  }
}
