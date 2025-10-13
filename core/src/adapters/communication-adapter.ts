import { loggedAxios as axios } from '@onecore/utilities'
import config from '../common/config'
import {
  Contact,
  ParkingSpaceOfferEmail,
  WorkOrderEmail,
  WorkOrderSms,
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
) => {
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
      throw new Error('Error sending parking space offer')
    }

    return result.data.content
  } catch (error) {
    logger.error(
      error,
      `Error sending parking space offer to ${parkingSpaceDetails.to}`
    )
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
