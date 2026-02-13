// fetch is stable in Node.js 20 LTS but eslint-plugin-n still flags it as experimental
/* eslint-disable n/no-unsupported-features/node-builtins */
import config from '../../../common/config'
import {
  Email,
  ParkingSpaceOfferEmail,
  ParkingSpaceNotificationEmail,
  WorkOrderEmail,
  ParkingSpaceAcceptOfferEmail,
  BulkEmail,
} from '@onecore/types'
import { logger } from '@onecore/utilities'

import { EmailV4Message, EmailV4Response } from './types'

const AcceptParkingSpaceOfferTemplateId = 205000000030455
const AdditionalParkingSpaceOfferTemplateId = 200000000092027
const ReplaceParkingSpaceOfferTemplateId = 200000000094058
const ParkingSpaceAssignedToOtherTemplateId = 200000000092051
const WorkOrderEmailTemplateId = 200000000146435
const WorkOrderExternalContractorEmailTemplateId = 200000000173744

// Email sender identity
const EMAIL_SENDER = 'Bostads Mimer AB <noreply@mimer.nu>'

// Infobip v4 Email API helper
const sendEmailV4 = async (
  messages: EmailV4Message[]
): Promise<EmailV4Response> => {
  const baseUrl = config.infobip.baseUrl.replace(/\/$/, '') // Remove trailing slash
  const url = `${baseUrl}/email/4/messages`
  const apiKey = config.infobip.apiKey

  logger.info(
    { url, messageCount: messages.length },
    'Sending email via v4 API'
  )

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `App ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(
      `Infobip Email API error: ${response.status} - ${errorBody}`
    )
  }

  return response.json() as Promise<EmailV4Response>
}

export const sendEmail = async (message: Email) => {
  logger.info({ to: message.to, subject: message.subject }, 'Sending email')

  try {
    const response = await sendEmailV4([
      {
        sender: EMAIL_SENDER,
        destinations: [{ to: [{ destination: message.to }] }],
        content: { subject: message.subject, text: message.text },
      },
    ])

    logger.info(
      { to: message.to, subject: message.subject },
      'Sending email complete'
    )
    return { data: response }
  } catch (error) {
    logger.error(error)
    throw error
  }
}

const getParkingSpaceImageUrl = (rentalObjectCode: string) => {
  const identifier = rentalObjectCode.slice(0, 7)
  return `https://pub.mimer.nu/bofaktablad/mediabank/Bilplatser/${identifier}.jpg`
}

export const sendParkingSpaceOffer = async (email: ParkingSpaceOfferEmail) => {
  logger.info({ baseUrl: config.infobip.baseUrl }, 'Sending template email')
  try {
    const placeholders = JSON.stringify({
      address: email.address,
      firstName: email.firstName,
      availableFrom: dateFormatter.format(new Date(email.availableFrom)),
      deadlineDate: dateFormatter.format(new Date(email.deadlineDate)),
      rent: formatToSwedishCurrency(email.rent),
      type: email.type,
      parkingSpaceId: email.parkingSpaceId,
      objectId: email.objectId,
      offerURL: email.offerURL,
      parkingSpaceImage: getParkingSpaceImageUrl(email.parkingSpaceId),
    })

    const templateId =
      email.applicationType === 'Replace'
        ? ReplaceParkingSpaceOfferTemplateId
        : AdditionalParkingSpaceOfferTemplateId

    const response = await sendEmailV4([
      {
        sender: EMAIL_SENDER,
        destinations: [
          {
            to: [{ destination: email.to, placeholders }],
          },
        ],
        content: { templateId },
      },
    ])

    return { data: response }
  } catch (error) {
    logger.error(error)
    throw error
  }
}

export const sendParkingSpaceAcceptOffer = async (
  email: ParkingSpaceAcceptOfferEmail
) => {
  logger.info(
    { baseUrl: config.infobip.baseUrl },
    'Sending Parking Space Accept Offer Email'
  )

  try {
    const placeholders = JSON.stringify({
      firstName: email.firstName,
      address: email.address,
      availableFrom: dateFormatter.format(new Date(email.availableFrom)),
      parkingSpaceId: email.parkingSpaceId,
      objectId: email.objectId,
      type: email.type,
      rent: formatToSwedishCurrency(email.rent),
      parkingSpaceImage: getParkingSpaceImageUrl(email.parkingSpaceId),
    })

    const response = await sendEmailV4([
      {
        sender: EMAIL_SENDER,
        destinations: [
          {
            to: [{ destination: email.to, placeholders }],
          },
        ],
        content: { templateId: AcceptParkingSpaceOfferTemplateId },
      },
    ])

    return { data: response }
  } catch (error) {
    logger.error(error)
    throw error
  }
}

const formatToSwedishCurrency = (numberStr: string) => {
  const number = parseFloat(numberStr)

  const formattedNumber = new Intl.NumberFormat('sv-SE', {
    //render max 2 decimals if there are decimals, otherwise render 0 decimals
    minimumFractionDigits: number % 1 === 0 ? 0 : 2,
    maximumFractionDigits: number % 1 === 0 ? 0 : 2,
  }).format(number)

  return formattedNumber + ' kr'
}

const dateFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'UTC' })

export const sendParkingSpaceAssignedToOther = async (
  emails: ParkingSpaceNotificationEmail[]
) => {
  try {
    const recipients = emails.map((email) => ({
      destination: email.to,
      placeholders: JSON.stringify({
        address: email.address,
        parkingSpaceId: email.parkingSpaceId,
      }),
    }))

    const response = await sendEmailV4([
      {
        sender: EMAIL_SENDER,
        destinations: [{ to: recipients }],
        content: { templateId: ParkingSpaceAssignedToOtherTemplateId },
      },
    ])

    return { data: response }
  } catch (error) {
    logger.error(error)
    throw error
  }
}

export const sendWorkOrderEmail = async (email: WorkOrderEmail) => {
  logger.info({ baseUrl: config.infobip.baseUrl }, 'Sending work order email')
  try {
    const placeholders = JSON.stringify({
      message: email.text,
      externalContractor: email.externalContractorName,
    })

    const templateId = email.externalContractorName
      ? WorkOrderExternalContractorEmailTemplateId
      : WorkOrderEmailTemplateId

    const response = await sendEmailV4([
      {
        sender: EMAIL_SENDER,
        destinations: [
          {
            to: [{ destination: email.to, placeholders }],
          },
        ],
        content: { templateId },
      },
    ])

    return { data: response }
  } catch (error) {
    logger.error(error)
    throw error
  }
}

export const sendBulkEmail = async (email: BulkEmail) => {
  logger.info(
    { recipientCount: email.emails.length, baseUrl: config.infobip.baseUrl },
    'Sending bulk email'
  )

  try {
    const recipients = email.emails.map((addr) => ({ destination: addr }))

    const response = await sendEmailV4([
      {
        sender: EMAIL_SENDER,
        destinations: [{ to: recipients }],
        content: { subject: email.subject, text: email.text },
      },
    ])

    logger.info(
      { recipientCount: email.emails.length },
      'Bulk email sent successfully'
    )
    return { data: response }
  } catch (error) {
    logger.error(error, 'Error sending bulk email')
    throw error
  }
}

export const healthCheck = async () => {
  const baseUrl = config.infobip.baseUrl.replace(/\/$/, '')
  const url = `${baseUrl}/email/4/messages`
  const apiKey = config.infobip.apiKey

  // Send a minimal invalid request to verify API connectivity
  // We expect a 400 validation error, which proves the API is reachable
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `App ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages: [] }),
  })

  // If we get 401/403, there's an auth problem
  if (response.status === 401 || response.status === 403) {
    throw new Error(`Infobip authentication failed: ${response.status}`)
  }

  // If we get 400 (validation error), the API is reachable and working
  // If we get 200 (shouldn't happen with empty messages), that's also fine
  if (response.status !== 400 && response.status !== 200) {
    const errorBody = await response.text()
    throw new Error(
      `Infobip health check failed: ${response.status} - ${errorBody}`
    )
  }
}
