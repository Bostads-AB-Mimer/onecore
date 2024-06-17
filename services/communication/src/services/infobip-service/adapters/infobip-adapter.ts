import { Infobip, AuthType } from '@infobip-api/sdk'
import config from '../../../common/config'
import { Email, ParkingSpaceOfferEmail } from 'onecore-types'
import { logger } from 'onecore-utilities'

const infobip = new Infobip({
  baseUrl: config.infobip.baseUrl,
  apiKey: config.infobip.apiKey,
  authType: AuthType.ApiKey,
})

const NewParkingSpaceOfferTemplateId = 200000000092027;
const ExistingParkingSpaceOfferTemplateId = 200000000094058;

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
  console.log('Sending template email', config.infobip.baseUrl)
  try {
    const toField = JSON.stringify({
      to: email.to,
      placeholders: {
        'adress': email.adress,
        'firstName': email.firstName,
        'availableFrom': email.availableFrom,
        'deadlineDate': email.deadlineDate,
        'rent': email.rent,
        'type': email.type,
        'parkingSpaceId': email.parkingSpaceId,
        'objectId': email.objectId,
      },
    });
    const response = await infobip.channels.email.send({
      from: 'Bostads Mimer AB <noreply@mimer.nu>',
      to: toField,
      templateId: email.hasParkingSpace ? ExistingParkingSpaceOfferTemplateId : NewParkingSpaceOfferTemplateId,
      subject: email.subject, // Might be overriden by tempalte
      text: email.text, // Should be overriden by template, but can be used as fallback
    });
    if (response.status === 200) {
      return response.data;
    } else {  
      throw new Error(response.body);
    }
  } catch (error) {
    console.error(error);
    throw error;
  }
};

