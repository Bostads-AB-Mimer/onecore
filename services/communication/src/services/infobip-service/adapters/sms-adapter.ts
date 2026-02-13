// fetch is stable in Node.js 20 LTS but eslint-plugin-n still flags it as experimental
/* eslint-disable n/no-unsupported-features/node-builtins */
import config from '../../../common/config'
import { ParkingSpaceOfferSms, WorkOrderSms, BulkSms } from '@onecore/types'
import { logger } from '@onecore/utilities'
import striptags from 'striptags'
import he from 'he'

// SMS sender ID registered with Infobip
const SMS_SENDER = 'Mimer'

// Infobip v3 SMS API helper
const sendSmsV3 = async (
  destinations: { to: string }[],
  text: string
): Promise<unknown> => {
  const baseUrl = config.infobip.baseUrl.replace(/\/$/, '') // Remove trailing slash
  const url = `${baseUrl}/sms/3/messages`
  const apiKey = config.infobip.apiKey
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

  return response.json()
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
  logger.info({ baseUrl: config.infobip.baseUrl }, 'Sending work order sms')
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

export const sendBulkSms = async (sms: BulkSms) => {
  logger.info(
    {
      recipientCount: sms.phoneNumbers.length,
      baseUrl: config.infobip.baseUrl,
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
