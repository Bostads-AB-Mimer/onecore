import { Infobip, AuthType } from '@infobip-api/sdk'
import config from '../../../common/config'
import { Email, ParkingSpaceOfferEmail, ParkingSpaceNotificationEmail, ParkingSpaceOfferSms } from 'onecore-types'
import { logger } from 'onecore-utilities'

const infobip = new Infobip({
  baseUrl: config.infobip.baseUrl,
  apiKey: config.infobip.apiKey,
  authType: AuthType.ApiKey,
})

const NewParkingSpaceOfferTemplateId = 200000000092027
const NewParkingSpaceOfferSmsTemplateId = 200000000094113 
const ExistingParkingSpaceOfferTemplateId = 200000000094058
const ParkingSpaceAssignedToOtherTemplateId = 200000000092051 

export const sendEmail = async (message: Email) => {
  logger.info({ to: message.to, subject: message.subject }, 'Sending email')

  try {
    const response = await infobip.channels.email.send({
      to: message.to,
      from: 'Bostads Mimer AB <noreply@mimer.nu>',
      subject: message.subject,
      text: message.text,
    })
    if (response.status === 200) {
      logger.info(
        { to: message.to, subject: message.subject },
        'Sending email complete'
      )
      return response.data
    } else {
      throw new Error(response.body)
    }
  } catch (error) {
    logger.error(error)
    throw error
  }
}

export const sendParkingSpaceOffer = async (email: ParkingSpaceOfferEmail) => {
  logger.info('Sending template email', config.infobip.baseUrl)
  try {
    const toField = JSON.stringify({
      to: email.to,
      placeholders: {
        address: email.address,
        firstName: email.firstName,
        availableFrom: dateFormatter.format(new Date(email.availableFrom)),
        deadlineDate: dateFormatter.format(new Date(email.deadlineDate)),
        rent: formatToSwedishCurrency(email.rent),
        type: email.type,
        parkingSpaceId: email.parkingSpaceId,
        objectId: email.objectId,
      },
    })
    const response = await infobip.channels.email.send({
      from: 'Bostads Mimer AB <noreply@mimer.nu>',
      to: toField,
      templateId: email.hasParkingSpace
        ? ExistingParkingSpaceOfferTemplateId
        : NewParkingSpaceOfferTemplateId,
      subject: email.subject, // Might be overriden by tempalte
      text: email.text, // Should be overriden by template, but can be used as fallback
    })
    if (response.status === 200) {
      return response.data;
    } else {  
      throw new Error(response.body);
    }
  } catch (error) {
    logger.error(error);
    throw error;
  }
};

const formatToSwedishCurrency = (numberStr: string) => {
  const number = parseFloat(numberStr);

  const formattedNumber = new Intl.NumberFormat('sv-SE', {
    //render max 2 decimals if there are decimals, otherwise render 0 decimals
    minimumFractionDigits: number % 1 === 0 ? 0 : 2,
    maximumFractionDigits: number % 1 === 0 ? 0 : 2,
  }).format(number);

  return formattedNumber + ' kr';
}

const dateFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'UTC' })

export const sendParkingSpaceOfferSms = async (sms: ParkingSpaceOfferSms) => {
  try {
    const response = await infobip.channels.sms.send({
        messages: [
            {
              destinations: [
                  { to: sms.phoneNumber },
              ],
              from: 'Mimer AB',
              text:`Hej ${sms.firstName}! Vad kul att du anmält intresse på den här bilplatsen! Vi vill nu veta om du vill ha kontraktet. Senast ${sms.deadlineDate} behöver du tacka ja eller nej via Mina sidor.`,
              templateId: NewParkingSpaceOfferSmsTemplateId
            }
        ]
    })
    logger.info('SMS sent successfully:');
    if (response.status === 200) {
      return response.data;
    } else {  
      throw new Error(response.body);
    }
  } catch (error) {
      logger.error('Error sending SMS:', error);
      throw error;
  }
};

export const sendParkingSpaceAssignedToOther = async (emails: ParkingSpaceNotificationEmail[]) => {
  try {
    const toField = emails.map(email => ({
      to: email.to,
      placeholders: {
        'address': email.address,
        'parkingSpaceId': email.parkingSpaceId,
      },
    }))
    const response = await infobip.channels.email.send({
      from: 'Bostads Mimer AB <noreply@mimer.nu>',
      to: toField,
      templateId: ParkingSpaceAssignedToOtherTemplateId,
      subject: "Ej erbjuden parkeringsplats",
    })
    if (response.status === 200) {
      return response.data;
    } else {
      throw new Error(response.body);
    }
  } catch (error) {
    logger.error(error)
    throw error
  }
}

export const healthCheck = async () => {
  const response = await infobip.channels.email.send({})

  if (
    response instanceof Error &&
    (response as Error).message != 'email.from is required.'
  )
    throw new Error((response as Error).message)
}
