import KoaRouter from '@koa/router'
import validator from 'validator'
import fs from 'node:fs'
import {
  Email,
  ParkingSpaceOfferEmail,
  ParkingSpaceNotificationEmail,
  ParkingSpaceAcceptOfferEmail,
  WorkOrderEmail,
  InspectionProtocolEmail,
  BulkEmail,
  NonScoredParkingSpaceApprovedEmail,
  NonScoredParkingSpaceDeniedEmail,
} from '@onecore/types'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import z from 'zod'

import {
  sendEmail,
  sendParkingSpaceOffer,
  sendParkingSpaceAssignedToOther,
  sendWorkOrderEmail,
  sendParkingSpaceAcceptOffer,
  sendBulkEmail,
  sendNonScoredParkingSpaceApproved,
  sendNonScoredParkingSpaceDenied,
} from '../adapters/email-adapter'
import {
  sendEmailInfobipSdk,
  sendInspectionProtocolEmail,
} from '../adapters/infobip-adapter'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { logOutboundDispatch } from '../../communication-log-service/adapters/db'

// Email sender used for fromAddress when logging outbound email dispatches.
// Mirrors the constant in email-adapter.ts (kept private there).
const EMAIL_SENDER = 'Bostads Mimer AB <noreply@mimer.nu>'
const EMAIL_PROVIDER = 'infobip'

const toArray = (input: unknown) => {
  if (Array.isArray(input)) {
    return input
  }
  return [input]
}

// TODO: Migrate to OkapiRouter so these routes contribute to /swagger.
// Each handler needs `{}` (or a real schema) added as the second arg.
// See TODO in src/api.ts for the broader migration plan.
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
      const result = await sendEmail({
        to: message.to,
        subject: message.subject,
        text: message.text,
      })
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

  router.post('(.*)/sendMessageWithAttachment', async (ctx) => {
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

  const NonScoredParkingSpaceApprovedEmailSchema = z.object({
    to: z.string().email(),
    subject: z.string(),
    text: z.string(),
    leaseId: z.string(),
    address: z.string(),
    availableFrom: z.string(),
    parkingSpaceId: z.string(),
    objectId: z.string(),
    type: z.string(),
    rent: z.string(),
  })
  router.post(
    '(.*)/sendNonScoredParkingSpaceApproved',
    parseRequestBody(NonScoredParkingSpaceApprovedEmailSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const body = ctx.request.body as NonScoredParkingSpaceApprovedEmail

      try {
        const result = await sendNonScoredParkingSpaceApproved(body)
        ctx.status = 204
        ctx.body = { content: result.data, ...metadata }
      } catch (error: any) {
        logger.error(
          { error: error.message },
          'Error in sendNonScoredParkingSpaceApproved'
        )
        ctx.status = 500
        ctx.body = {
          error: error.message,
          ...metadata,
        }
      }
    }
  )

  const NonScoredParkingSpaceDeniedEmailSchema = z.object({
    to: z.string().email(),
    subject: z.string(),
    text: z.string(),
    address: z.string(),
    availableFrom: z.string(),
    parkingSpaceId: z.string(),
    objectId: z.string(),
    type: z.string(),
    rent: z.string(),
  })
  router.post(
    '(.*)/sendNonScoredParkingSpaceDenied',
    parseRequestBody(NonScoredParkingSpaceDeniedEmailSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const body = ctx.request.body as NonScoredParkingSpaceDeniedEmail

      try {
        const result = await sendNonScoredParkingSpaceDenied(body)
        ctx.status = 204
        ctx.body = { content: result.data, ...metadata }
      } catch (error: any) {
        logger.error(
          { error: error.message },
          'Error in sendNonScoredParkingSpaceDenied'
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

  const InspectionProtocolEmailSchema = z.object({
    to: z.string().email(),
    subject: z.string(),
    text: z.string(),
    firstName: z.string(),
    attachments: z
      .array(
        z.object({
          filename: z.string(),
          content: z.string(),
          contentType: z.string(),
        })
      )
      .optional(),
  })
  router.post(
    '(.*)/sendInspectionProtocolEmail',
    parseRequestBody(InspectionProtocolEmailSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const body = ctx.request.body as InspectionProtocolEmail

      try {
        const result = await sendInspectionProtocolEmail(body)
        ctx.status = 204
        ctx.body = { content: result.data, ...metadata }
      } catch (error: any) {
        logger.error(
          { error: error.message },
          'Error in sendInspectionProtocolEmail'
        )
        ctx.status = 500
        ctx.body = {
          error: error.message,
          ...metadata,
        }
      }
    }
  )

  router.post('(.*)/send-email', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { to, subject, body } = ctx.request.body
    const { files } = ctx.request

    const attachments: { data: Buffer; name: string }[] = []

    if (files?.attachments) {
      toArray(files.attachments).forEach((f) => {
        attachments.push({
          data: fs.readFileSync(f.filepath),
          name: f.originalFilename ?? '',
        })
      })
    }

    try {
      const result = await sendEmailInfobipSdk(to, subject, body, attachments)
      ctx.status = 200
      ctx.body = { content: result, ...metadata }
    } catch (error: any) {
      ctx.status = 500
      ctx.body = {
        error: error.message,
        ...metadata,
      }
    }
  })

  // Accepts either the legacy shape (emails: string[]) or the new richer
  // shape (recipients: [{kundId?, emailAddress}]). Logging preserves the
  // kundId association when callers pass it.
  const SendBulkEmailSchema = z.object({
    emails: z.array(z.string()).optional(),
    recipients: z
      .array(
        z.object({
          kundId: z.string().optional(),
          emailAddress: z.string(),
        })
      )
      .optional(),
    subject: z.string().min(1),
    text: z.string().min(1),
    triggeredByUser: z.string().optional(),
    audienceCriteria: z.object({}).passthrough().optional(),
    templateId: z.string().uuid().optional(),
  })
  type SendBulkEmailBody = z.infer<typeof SendBulkEmailSchema>

  router.post(
    '(.*)/sendBulkEmail',
    parseRequestBody(SendBulkEmailSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)

      try {
        const body = ctx.request.body as SendBulkEmailBody

        const inputRecipients: Array<{
          kundId?: string
          emailAddress: string
        }> =
          body.recipients ??
          (body.emails ?? []).map((e) => ({ emailAddress: e }))

        if (inputRecipients.length === 0) {
          ctx.status = 400
          ctx.body = {
            reason: 'Must provide emails or recipients',
            ...metadata,
          }
          return
        }

        const validRecipients: Array<{
          kundId?: string
          emailAddress: string
        }> = []
        const invalidEmails: string[] = []

        for (const r of inputRecipients) {
          if (validator.isEmail(r.emailAddress)) {
            validRecipients.push(r)
          } else {
            invalidEmails.push(r.emailAddress)
          }
        }

        if (validRecipients.length === 0) {
          ctx.status = 400
          ctx.body = {
            reason: 'No valid email addresses',
            invalid: invalidEmails,
            ...metadata,
          }
          return
        }

        const sendResult = await sendBulkEmail({
          emails: validRecipients.map((r) => r.emailAddress),
          subject: body.subject,
          text: body.text,
        })

        // Strict: if logging fails the catch below turns it into a 500 even
        // though the email already went out. Better an audit-complete log
        // path with a noisy failure than a phantom send.
        await logOutboundDispatch({
          channel: 'email',
          fromAddress: EMAIL_SENDER,
          subject: body.subject,
          body: body.text,
          messageType: 'bulk_email',
          provider: EMAIL_PROVIDER,
          triggeredByUser: body.triggeredByUser,
          audienceCriteria: body.audienceCriteria,
          templateId: body.templateId,
          recipients: validRecipients.map((r, i) => ({
            kundId: r.kundId,
            toAddress: r.emailAddress,
            externalMessageId: sendResult.data.messages?.[i]?.messageId,
            status: 'sent',
          })),
        })

        const successful = validRecipients.map((r) => r.emailAddress)
        ctx.status = 200
        ctx.body = {
          content: {
            successful,
            invalid: invalidEmails,
            totalSent: successful.length,
            totalInvalid: invalidEmails.length,
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
    }
  )
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
