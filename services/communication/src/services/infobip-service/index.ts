import KoaRouter from '@koa/router'
import validator from 'validator'
import { validator as phoneValidator, normalize } from 'telefonnummer'
import {
  sendEmail,
  sendParkingSpaceOffer,
  sendParkingSpaceAssignedToOther,
  sendParkingSpaceOfferSms,
  sendWorkOrderSms,
  sendWorkOrderEmail,
  sendParkingSpaceAcceptOffer,
  sendBulkSms,
  sendBulkEmail,
} from './adapters/infobip-adapter'
import {
  Email,
  ParkingSpaceOfferEmail,
  ParkingSpaceNotificationEmail,
  ParkingSpaceAcceptOfferEmail,
  ParkingSpaceOfferSms,
  WorkOrderSms,
  WorkOrderEmail,
  BulkSms,
  BulkEmail,
} from '@onecore/types'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { parseRequestBody } from '../../middlewares/parse-request-body'
import z from 'zod'

/**
 * Extract Swedish phone number from text that may contain names/labels
 * Database entries like "Dottern Ingrid: 0700096176" should extract "0700096176"
 */
function extractPhoneNumber(input: string): string {
  // Try to find Swedish mobile number (07XXXXXXXX)
  const mobileMatch = input.match(/07\d{8}/)
  if (mobileMatch) return mobileMatch[0]

  // Try to find landline/other pattern (0X followed by 6-9 digits, may have spaces/dashes)
  const phoneMatch = input.match(/0\d[\d\s-]{6,12}/)
  if (phoneMatch) return phoneMatch[0].replace(/[\s-]/g, '')

  return input // Return original if no pattern found
}

export const routes = (router: KoaRouter) => {
  router.post('(.*)/sendMessage', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const message = ctx.request.body
    if (!isMessageEmail(message)) {
      ctx.status = 400
      ctx.body = { reason: 'Message is not an email object', ...metadata }
      return
    }
    try {
      const result = await sendEmail(message)
      ctx.status = 200
      ctx.body = { content: result.data, ...metadata }
    } catch (error: any) {
      ctx.status = 500
      ctx.body = {
        error: error.message,
        ...metadata,
      }
    }
  })

  router.post('(.*)/sendParkingSpaceOffer', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const emailData = ctx.request.body

    if (!isParkingSpaceOfferEmail(emailData)) {
      ctx.status = 400
      ctx.body = { reason: 'Message is not an email object', ...metadata }
      return
    }
    try {
      const result = await sendParkingSpaceOffer(emailData)
      ctx.status = 200
      ctx.body = { content: result.data, ...metadata }
    } catch (error: any) {
      ctx.status = 500
      ctx.body = {
        error: error.message,
        ...metadata,
      }
    }
  })

  const ParkingSpaceAcceptOfferEmailSchema = z.object({
    to: z.string().email(),
    subject: z.string(),
    text: z.string(),
    firstName: z.string(),
    parkingSpaceId: z.string(),
    address: z.string(),
    availableFrom: z.string(),
    rent: z.string(),
    type: z.string(),
    objectId: z.string(),
  })
  router.post(
    '(.*)/sendParkingSpaceAcceptOffer',
    parseRequestBody(ParkingSpaceAcceptOfferEmailSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const body = ctx.request.body as ParkingSpaceAcceptOfferEmail

      try {
        const result = await sendParkingSpaceAcceptOffer(body)
        ctx.status = 204
        ctx.body = { content: result.data, ...metadata }
      } catch (error: any) {
        logger.error(
          { error: error.message },
          'Error in sendParkingSpaceAcceptOffer'
        )
        ctx.status = 500
        ctx.body = {
          error: error.message,
          ...metadata,
        }
      }
    }
  )

  router.post('(.*)/sendNotification', async (ctx) => {
    const { applicants } = ctx.request.body as {
      applicants: ParkingSpaceNotificationEmail[]
    }
    if (!Array.isArray(applicants)) {
      ctx.throw(400, 'Message is not an email object')
      return
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
    const metadata = generateRouteMetadata(ctx)

    try {
      const sms = ctx.request.body
      if (!isValidParkingSpaceOfferSms(sms)) {
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
      ctx.body = { content: result, ...metadata }
    } catch (error: any) {
      ctx.status = 500
      ctx.body = {
        message: error.message,
        ...metadata,
      }
    }
  })

  router.post('(.*)/sendWorkOrderSms', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    try {
      const sms = ctx.request.body
      if (!isValidWorkOrderSms(sms)) {
        ctx.status = 400
        ctx.body = {
          reason: 'Message is not a WorkOrderSms object',
          ...metadata,
        }
        return
      }

      let phoneNumber = sms.phoneNumber
      if (!phoneValidator(phoneNumber, { onlyMobile: true })) {
        ctx.status = 400
        ctx.body = {
          reason: 'Invalid phone number',
          ...metadata,
        }
        return
      }
      phoneNumber = '46' + normalize(phoneNumber).slice(1)

      const result = await sendWorkOrderSms({
        text: sms.text,
        phoneNumber,
        externalContractorName: sms.externalContractorName,
      })
      ctx.status = 200
      ctx.body = { content: result, ...metadata }
    } catch (error: any) {
      ctx.status = 500
      ctx.body = {
        message: error.message,
        ...metadata,
      }
    }
  })

  router.post('(.*)/sendWorkOrderEmail', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const emailData = ctx.request.body as WorkOrderEmail

    if (!isMessageEmail(emailData)) {
      ctx.status = 400
      ctx.body = { reason: 'Message is not an email object', ...metadata }
      return
    }

    try {
      const result = await sendWorkOrderEmail(emailData)
      ctx.status = 200
      ctx.body = { content: result.data, ...metadata }
    } catch (error: any) {
      ctx.status = 500
      ctx.body = {
        error: error.message,
        ...metadata,
      }
    }
  })

  router.post('(.*)/sendBulkSms', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    try {
      const sms = ctx.request.body as Partial<BulkSms>

      // Check for exceeding recipient limit with specific error message
      if (
        Array.isArray(sms?.phoneNumbers) &&
        sms.phoneNumbers.length > MAX_BULK_SMS_RECIPIENTS
      ) {
        ctx.status = 400
        ctx.body = {
          reason: 'TOO_MANY_RECIPIENTS',
          message: `För många mottagare. Maximalt antal är ${MAX_BULK_SMS_RECIPIENTS.toLocaleString('sv-SE')}.`,
          maxRecipients: MAX_BULK_SMS_RECIPIENTS,
          requestedRecipients: sms.phoneNumbers.length,
          ...metadata,
        }
        return
      }

      if (!isValidBulkSms(sms)) {
        ctx.status = 400
        ctx.body = {
          reason:
            'Invalid request. Requires phoneNumbers (1-15000) and text (1-1600 chars)',
          ...metadata,
        }
        return
      }

      // Validate and normalize phone numbers
      const validPhones: string[] = []
      const invalidPhones: string[] = []

      for (const phoneNumber of sms.phoneNumbers) {
        const extracted = extractPhoneNumber(phoneNumber)
        if (phoneValidator(extracted)) {
          validPhones.push('46' + normalize(extracted).slice(1))
        } else {
          invalidPhones.push(phoneNumber)
        }
      }

      if (validPhones.length === 0) {
        ctx.status = 400
        ctx.body = {
          reason: 'No valid phone numbers',
          invalid: invalidPhones,
          ...metadata,
        }
        return
      }

      const result = await sendBulkSms({
        phoneNumbers: validPhones,
        text: sms.text,
      })

      ctx.status = 200
      ctx.body = {
        content: {
          successful: validPhones,
          invalid: invalidPhones,
          totalSent: validPhones.length,
          totalInvalid: invalidPhones.length,
          infobipResponse: result,
        },
        ...metadata,
      }
    } catch (error: any) {
      ctx.status = 500
      ctx.body = {
        message: error.message,
        ...metadata,
      }
    }
  })

  router.post('(.*)/sendBulkEmail', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    try {
      const email = ctx.request.body as Partial<BulkEmail>

      if (!isValidBulkEmail(email)) {
        ctx.status = 400
        ctx.body = {
          reason: 'Invalid request. Requires emails, subject, and text',
          ...metadata,
        }
        return
      }

      // Validate email addresses
      const validEmails: string[] = []
      const invalidEmails: string[] = []

      for (const emailAddress of email.emails) {
        if (validator.isEmail(emailAddress)) {
          validEmails.push(emailAddress)
        } else {
          invalidEmails.push(emailAddress)
        }
      }

      if (validEmails.length === 0) {
        ctx.status = 400
        ctx.body = {
          reason: 'No valid email addresses',
          invalid: invalidEmails,
          ...metadata,
        }
        return
      }

      const result = await sendBulkEmail({
        emails: validEmails,
        subject: email.subject,
        text: email.text,
      })

      ctx.status = 200
      ctx.body = {
        content: {
          successful: validEmails,
          invalid: invalidEmails,
          totalSent: validEmails.length,
          totalInvalid: invalidEmails.length,
          infobipResponse: result,
        },
        ...metadata,
      }
    } catch (error: any) {
      ctx.status = 500
      ctx.body = {
        message: error.message,
        ...metadata,
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
    typeof emailData.applicationType === 'string' &&
    typeof emailData.offerURL === 'string'
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

export const isValidParkingSpaceOfferSms = (
  sms: any
): sms is ParkingSpaceOfferSms => {
  return (
    typeof sms === 'object' &&
    sms !== null &&
    typeof sms.phoneNumber === 'string' &&
    typeof sms.firstName === 'string' &&
    typeof sms.deadlineDate === 'string'
  )
}

export const isValidWorkOrderSms = (sms: any): sms is WorkOrderSms => {
  return (
    typeof sms === 'object' &&
    sms !== null &&
    typeof sms.phoneNumber === 'string' &&
    typeof sms.text === 'string' &&
    (typeof sms.externalContractorName === 'string' ||
      typeof sms.externalContractorName === 'undefined')
  )
}

export const MAX_BULK_SMS_RECIPIENTS = 15000

export const isValidBulkSms = (sms: any): sms is BulkSms => {
  return (
    typeof sms === 'object' &&
    sms !== null &&
    Array.isArray(sms.phoneNumbers) &&
    sms.phoneNumbers.length > 0 &&
    sms.phoneNumbers.length <= MAX_BULK_SMS_RECIPIENTS &&
    sms.phoneNumbers.every((p: any) => typeof p === 'string') &&
    typeof sms.text === 'string' &&
    sms.text.length > 0 &&
    sms.text.length <= 1600
  )
}

export const isValidBulkEmail = (email: any): email is BulkEmail => {
  return (
    typeof email === 'object' &&
    email !== null &&
    Array.isArray(email.emails) &&
    email.emails.length > 0 &&
    email.emails.every((e: any) => typeof e === 'string') &&
    typeof email.subject === 'string' &&
    email.subject.length > 0 &&
    typeof email.text === 'string' &&
    email.text.length > 0
  )
}
