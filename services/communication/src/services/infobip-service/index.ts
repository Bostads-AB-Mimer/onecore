import KoaRouter from '@koa/router'
import validator from 'validator'
import { validator as phoneValidator, normalize } from 'telefonnummer'
import { sendEmail, sendParkingSpaceOffer, sendParkingSpaceAssignedToOther, sendParkingSpaceOfferSms } from './adapters/infobip-adapter'
import { Email, ParkingSpaceOfferEmail, ParkingSpaceNotificationEmail, ParkingSpaceOfferSms } from 'onecore-types'
import config from '../../common/config'

export const routes = (router: KoaRouter) => {
  router.post('(.*)/sendMessage', async (ctx) => {
    const message = ctx.request.body
    if (!isMessageEmail(message)) {
      ctx.throw(400, 'Message is not an email object')
      return
    }
    try {
      const result = await sendEmail(message)
      ctx.status = 200
      ctx.body = result.data
    } catch (error: any) {
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })

  router.post('(.*)/sendParkingSpaceOffer', async (ctx) => {
    const emailData = ctx.request.body
    if (!isParkingSpaceOfferEmail(emailData)) {
      ctx.throw(400, 'Message is not an email object')
      return
    }
    try {
      const result = await sendParkingSpaceOffer(emailData)
      ctx.status = 200
      ctx.body = result.data
    } catch (error: any) {
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })
  router.post('(.*)/sendNotification', async (ctx) => {
    const { applicants } = ctx.request.body as { applicants: ParkingSpaceNotificationEmail[] }
    if (!Array.isArray(applicants)) {
      ctx.throw(400, 'Message is not an email object')
      return;
    }
    try {
      const result = await sendParkingSpaceAssignedToOther(applicants)
      ctx.status = 200
      ctx.body = result.data
    } catch (error: any) {
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })

  router.post('(.*)/sendSms', async (ctx) => {
    try {
      const sms = ctx.request.body
      if (!isValidSms(sms)) {
        ctx.throw(400, 'Message is not an sms object')
        return
      }
  
      let phoneNumber = sms.phoneNumber
      if (!phoneValidator(phoneNumber)) {
        ctx.throw(400, 'Invalid phone number')
        return
      }
      phoneNumber = '46' + normalize(phoneNumber).slice(1)
  
      const result = await sendParkingSpaceOfferSms({ ...sms, phoneNumber })
      ctx.status = 200
      ctx.body = result
    } catch (error: any) {
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })

}

export const isParkingSpaceOfferEmail = (
  emailData: any
): emailData is ParkingSpaceOfferEmail => {
  return (
    typeof emailData === 'object' &&
    emailData !== null &&
    typeof emailData.to === 'string' &&
    validator.isEmail(emailData.to) &&
    typeof emailData.subject === 'string' &&
    typeof emailData.text === 'string' &&
    typeof emailData.address === 'string' &&
    typeof emailData.firstName === 'string' &&
    typeof emailData.availableFrom === 'string' &&
    typeof emailData.deadlineDate === 'string' &&
    typeof emailData.rent === 'string' &&
    typeof emailData.type === 'string' &&
    typeof emailData.parkingSpaceId === 'string' &&
    typeof emailData.objectId === 'string' &&
    typeof emailData.hasParkingSpace === 'boolean'
  )
}

export const isMessageEmail = (message: any): message is Email => {
  return !!(
    message &&
    typeof message === 'object' &&
    message.to &&
    typeof message.to === 'string' &&
    validator.isEmail(message.to) &&
    message.subject &&
    typeof message.subject === 'string' &&
    message.text &&
    typeof message.text === 'string'
  )
}

export const isValidSms = (sms: any): sms is ParkingSpaceOfferSms => {
  return (
    typeof sms === 'object' &&
    sms !== null &&
    typeof sms.phoneNumber === 'string' &&
    typeof sms.firstName === 'string' && 
    typeof sms.deadlineDate === 'string'
  );
}
