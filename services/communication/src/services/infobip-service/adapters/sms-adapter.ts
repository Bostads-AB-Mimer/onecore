// fetch is stable in Node.js 20 LTS but eslint-plugin-n still flags it as experimental
/* eslint-disable n/no-unsupported-features/node-builtins */
import config from '../../../common/config'
import { ParkingSpaceOfferSms, WorkOrderSms } from '@onecore/types'
import { logger } from '@onecore/utilities'
import striptags from 'striptags'
import he from 'he'

// SMS sender ID registered with Infobip
const SMS_SENDER = 'Mimer'

// Response from POSTing to Infobip's /sms/3/messages (outbound SMS send).
export type InfobipSendSmsResponse = {
  messages: Array<{
    to: string
    messageId: string
    status: {
      groupId: number
      groupName: string
      id: number
      name: string
      description: string
    }
  }>
}

// SMS is sent via the Tele2 instance of the Infobip SMS platform.
// Same /sms/3/messages contract as Infobip, but uses the separate
// Tele2 procurement credentials (config.tele2). Email still uses config.infobip.
const sendSmsV3 = async (
  destinations: { to: string }[],
  text: string
): Promise<InfobipSendSmsResponse> => {
  const baseUrl = config.tele2.baseUrl.replace(/\/$/, '') // Remove trailing slash
  const url = `${baseUrl}/sms/3/messages`
  const apiKey = config.tele2.apiKey
  logger.info({ url }, 'Sending SMS via v3 API')
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `App ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        {
          sender: SMS_SENDER,
          destinations,
          content: { text },
        },
      ],
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Infobip SMS API error: ${response.status} - ${errorBody}`)
  }

  return response.json() as Promise<InfobipSendSmsResponse>
}

export const sendParkingSpaceOfferSms = async (sms: ParkingSpaceOfferSms) => {
  try {
    const text = `Hej ${sms.firstName}! Vad kul att du anmält intresse på den här bilplatsen! Vi vill nu veta om du vill ha kontraktet. Senast ${sms.deadlineDate} behöver du tacka ja eller nej via Mina sidor.`
    const response = await sendSmsV3([{ to: sms.phoneNumber }], text)
    logger.info('SMS sent successfully')
    return response
  } catch (error) {
    logger.error(error, 'Error sending SMS')
    throw error
  }
}

export const sendWorkOrderSms = async (sms: WorkOrderSms) => {
  logger.info({ baseUrl: config.tele2.baseUrl }, 'Sending work order sms')
  const message = he.decode(striptags(sms.text.replace(/<br\s*\/?>/gi, '\n')))
  const noreply = sms.externalContractorName
    ? `Hälsningar, ${sms.externalContractorName} i uppdrag från Mimer`
    : 'Detta sms går ej att svara på. Det går bra att återkoppla i ärendet på "Mina sidor".'

  try {
    const text = `${message}\n\n${noreply}`
    const response = await sendSmsV3([{ to: sms.phoneNumber }], text)
    logger.info('Work order SMS sent successfully')
    return response
  } catch (error) {
    logger.error(error, 'Error sending SMS')
    throw error
  }
}

export const sendBulkSms = async (sms: {
  phoneNumbers: string[]
  text: string
}) => {
  logger.info(
    {
      recipientCount: sms.phoneNumbers.length,
      baseUrl: config.tele2.baseUrl,
    },
    'Sending bulk SMS'
  )

  try {
    const destinations = sms.phoneNumbers.map((phone: string) => ({
      to: phone,
    }))
    const response = await sendSmsV3(destinations, sms.text)
    logger.info(
      { recipientCount: sms.phoneNumbers.length },
      'Bulk SMS sent successfully'
    )
    return response
  } catch (error) {
    logger.error(error, 'Error sending bulk SMS')
    throw error
  }
}

// Verifies connectivity to the Tele2 (Infobip) SMS API used for sending SMS.
export const tele2SmsHealthCheck = async () => {
  const baseUrl = config.tele2.baseUrl.replace(/\/$/, '')
  const url = `${baseUrl}/sms/3/messages`
  const apiKey = config.tele2.apiKey

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
    throw new Error(`Tele2 SMS authentication failed: ${response.status}`)
  }

  // If we get 400 (validation error), the API is reachable and working
  // If we get 200 (shouldn't happen with empty messages), that's also fine
  if (response.status !== 400 && response.status !== 200) {
    const errorBody = await response.text()
    throw new Error(
      `Tele2 SMS health check failed: ${response.status} - ${errorBody}`
    )
  }
}
