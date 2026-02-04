import { loggedAxios as axios } from '@onecore/utilities'
import config from '../common/config'
import {
  Contact,
  ParkingSpaceOfferEmail,
  ParkingSpaceAcceptOfferEmail,
  WorkOrderEmail,
  WorkOrderSms,
  EmailAttachment,
} from '@onecore/types'
import { logger } from '@onecore/utilities'
import { AdapterResult } from './types'

export const sendNotificationToContact = async (
  recipientContact: Contact,
  subject: string,
  message: string
) => {
  try {
    if (!recipientContact.emailAddress)
      throw new Error('Recipient has no email address')

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

    return result.data.content
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

    if (process.env.NODE_ENV !== 'production') {
      subject = `${process.env.NODE_ENV?.toUpperCase()} - ${subject}`
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

    return result.data.content
  } catch (error) {
    logger.error(error, `Error sending notification to role ${recipientRole}`)
  }
}

export const sendParkingSpaceOfferEmail = async (
  parkingSpaceDetails: ParkingSpaceOfferEmail
): Promise<AdapterResult<null, 'unknown'>> => {
  try {
    const axiosOptions = {
      method: 'POST',
      data: parkingSpaceDetails,
      headers: {
        'Content-type': 'application/json',
      },
    }

    if (process.env.NODE_ENV !== 'production')
      parkingSpaceDetails.to = config.emailAddresses.tenantDefault

    const result = await axios(
      `${config.communicationService.url}/sendParkingSpaceOffer`,
      axiosOptions
    )

    if (result.status !== 204) {
      logger.error(
        { status: result.status, data: result.data },
        'Unexpected response from communication service'
      )
      return { ok: false, err: 'unknown', statusCode: result.status }
    }

    return { ok: true, data: result.data.content }
  } catch (error) {
    logger.error(
      error,
      `Error sending parking space offer to ${parkingSpaceDetails.to}`
    )
    return { ok: false, err: 'unknown', statusCode: 500 }
  }
}

export const sendParkingSpaceAcceptOfferEmail = async (
  parkingSpaceDetails: ParkingSpaceAcceptOfferEmail
): Promise<AdapterResult<null, 'unknown'>> => {
  try {
    const axiosOptions = {
      method: 'POST',
      data: parkingSpaceDetails,
      headers: {
        'Content-type': 'application/json',
      },
    }

    if (process.env.NODE_ENV !== 'production')
      parkingSpaceDetails.to = config.emailAddresses.tenantDefault

    const result = await axios(
      `${config.communicationService.url}/sendParkingSpaceAcceptOffer`,
      axiosOptions
    )

    if (result.status !== 204) {
      logger.error(
        { status: result.status, data: result.data },
        'Unexpected response from communication service'
      )
      return { ok: false, err: 'unknown', statusCode: result.status }
    }

    return { ok: true, data: result.data.content }
  } catch (error) {
    logger.error(
      error,
      `Error sending parking space accept offer to ${parkingSpaceDetails.to}`
    )
    return { ok: false, err: 'unknown', statusCode: 500 }
  }
}

export const sendWorkOrderSms = async ({
  phoneNumber,
  text,
  externalContractorName,
}: WorkOrderSms): Promise<AdapterResult<any, 'error'>> => {
  try {
    const axiosOptions = {
      method: 'POST',
      headers: {
        'Content-type': 'application/json',
      },
    }

    const result = await axios(
      `${config.communicationService.url}/sendWorkOrderSms`,
      {
        ...axiosOptions,
        data: { phoneNumber, text, externalContractorName },
      }
    )

    if (result.status !== 200) {
      return { ok: false, err: 'error', statusCode: result.status }
    }

    return { ok: true, data: result.data.content }
  } catch {
    return { ok: false, err: 'error', statusCode: 500 }
  }
}

export const sendWorkOrderEmail = async ({
  to,
  subject,
  text,
  externalContractorName,
}: WorkOrderEmail): Promise<AdapterResult<any, 'error'>> => {
  try {
    const axiosOptions = {
      method: 'POST',
      headers: {
        'Content-type': 'application/json',
      },
    }

    const result = await axios(
      `${config.communicationService.url}/sendWorkOrderEmail`,
      {
        ...axiosOptions,
        data: { to, subject, text, externalContractorName },
      }
    )

    if (result.status !== 200) {
      return { ok: false, err: 'error', statusCode: result.status }
    }

    return { ok: true, data: result.data.content }
  } catch {
    return { ok: false, err: 'error', statusCode: 500 }
  }
}

export const sendNotificationToContactWithAttachment = async (
  recipientContact: Contact,
  subject: string,
  message: string,
  attachments: EmailAttachment[]
): Promise<AdapterResult<unknown, 'no-email' | 'unknown'>> => {
  try {
    if (!recipientContact.emailAddress) {
      return { ok: false, err: 'no-email', statusCode: 400 }
    }

    const axiosOptions = {
      method: 'POST',
      data: {
        to:
          process.env.NODE_ENV === 'production'
            ? recipientContact.emailAddress
            : config.emailAddresses.tenantDefault,
        subject,
        text: message,
        attachments,
      },
      headers: {
        'Content-type': 'application/json',
      },
    }

    const result = await axios(
      `${config.communicationService.url}/sendMessageWithAttachment`,
      axiosOptions
    )

    return { ok: true, data: result.data.content }
  } catch (error) {
    logger.error(
      error,
      `Error sending notification with attachment to contact ${recipientContact.contactCode}`
    )
    return { ok: false, err: 'unknown', statusCode: 500 }
  }
}
