import axios from 'axios'
import config from '../common/config'
import { Contact } from 'onecore-types'

export const sendNotificationToContact = async (
  recipientContact: Contact,
  subject: string,
  message: string
) => {
  const axiosOptions = {
    method: 'POST',
    data: {
      to: recipientContact.emailAddress,
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
}

export const sendNotificationToRole = async (
  recipientRole: string,
  subject: string,
  message: string
) => {
  const recipientEmailAddress = (
    config.emailAddresses as Record<string, string>
  )[recipientRole]

  if (!recipientEmailAddress) {
    throw new Error(
      `Error sending notification to ${recipientRole}. No email address specified for role.`
    )
  }

  console.log('Sending to', recipientEmailAddress)

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
}
