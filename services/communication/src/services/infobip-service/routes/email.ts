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

// triggeredByUser value for emails with no human initiator (the automated
// offer flow). Routes with a known initiator pass triggeredBy instead.
const AUTOMATIC_DISPATCH_USER = 'Automatiskt utskick'

// Records a customer-facing parking-space (rental offer) email in the
// communication log. Strict but non-blocking: a logging failure is logged
// loudly for monitoring but never fails the send/offer flow, since the email
// has already gone out via Infobip. These routes have no human consumer
// reading the response, so there is nothing to surface a warning to.
const logParkingSpaceEmail = async (params: {
  messageType: string
  to: string
  contactCode: string
  subject: string
  body: string
  // The admin who initiated the send, if any; falls back to the automatic
  // dispatch label for flows with no human initiator.
  triggeredBy?: string
  sendResult: { messages?: Array<{ messageId: string }> }
}) => {
  try {
    await logOutboundDispatch({
      channel: 'email',
      fromAddress: EMAIL_SENDER,
      subject: params.subject,
      body: params.body,
      messageType: params.messageType,
      provider: EMAIL_PROVIDER,
      triggeredByUser: params.triggeredBy ?? AUTOMATIC_DISPATCH_USER,
      recipients: [
        {
          contactCode: params.contactCode,
          toAddress: params.to,
          externalMessageId: params.sendResult.messages?.[0]?.messageId,
          status: 'pending',
        },
      ],
    })
  } catch (logError) {
    logger.error(
      { err: logError, messageType: params.messageType, to: params.to },
      'Failed to write communication-log entry for parking space email'
    )
  }
}

// Records a tenant-facing work-order email (sent from Odoo via
// /sendWorkOrderEmail) in the communication log. Strict but non-blocking: the
// email already went out, so a logging failure must not fail the send. Instead
// we log loudly for monitoring and return a non-blocking warning the route
// surfaces via `warnings` (same shape as the bulk routes). Returns [] on
// success. Mirrors logWorkOrderTenantSms in sms.ts.
const logWorkOrderTenantEmail = async (params: {
  to: string
  contactCode: string
  subject: string
  body: string
  triggeredByUser?: string
  sendResult: { messages?: Array<{ messageId: string }> }
}): Promise<string[]> => {
  try {
    await logOutboundDispatch({
      channel: 'email',
      fromAddress: EMAIL_SENDER,
      subject: params.subject,
      body: params.body,
      messageType: 'work_order_tenant_mail',
      provider: EMAIL_PROVIDER,
      triggeredByUser: params.triggeredByUser,
      recipients: [
        {
          contactCode: params.contactCode,
          toAddress: params.to,
          externalMessageId: params.sendResult.messages?.[0]?.messageId,
          status: 'pending',
        },
      ],
    })
    return []
  } catch (logError) {
    // Keep the warning generic for the client; the real error (which can
    // contain internal/DB detail) stays in logger.error only.
    logger.error(
      { err: logError, to: params.to },
      'Failed to write communication-log entry for work order tenant email'
    )
    return ['Communication log failed']
  }
}

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
      await logParkingSpaceEmail({
        messageType: 'parking_space_offer',
        to: emailData.to,
        contactCode: emailData.contactCode,
        subject: emailData.subject,
        body: emailData.text,
        sendResult: result.data,
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

  const ParkingSpaceAcceptOfferEmailSchema = z.object({
    to: z.string().email(),
    contactCode: z.string(),
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
        await logParkingSpaceEmail({
          messageType: 'parking_space_accept_offer',
          to: body.to,
          contactCode: body.contactCode,
          subject: body.subject,
          body: body.text,
          sendResult: result.data,
        })
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
    contactCode: z.string(),
    triggeredBy: z.string().optional(),
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
        await logParkingSpaceEmail({
          messageType: 'non_scored_parking_space_approved',
          to: body.to,
          contactCode: body.contactCode,
          triggeredBy: body.triggeredBy,
          subject: body.subject,
          body: body.text,
          sendResult: result.data,
        })
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
    contactCode: z.string(),
    triggeredBy: z.string().optional(),
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
        await logParkingSpaceEmail({
          messageType: 'non_scored_parking_space_denied',
          to: body.to,
          contactCode: body.contactCode,
          triggeredBy: body.triggeredBy,
          subject: body.subject,
          body: body.text,
          sendResult: result.data,
        })
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

      // TODO: contactCode is TEMPORARILY OPTIONAL while older Odoo callers are
      // updated to send it. We only log the dispatch when it's present so the
      // row attaches to the customer timeline. Once every caller sends it,
      // make contactCode required and drop this `if`.
      const warnings = emailData.contactCode
        ? await logWorkOrderTenantEmail({
            to: emailData.to,
            contactCode: emailData.contactCode,
            subject: emailData.subject,
            body: emailData.text,
            triggeredByUser: emailData.triggeredByUser,
            sendResult: result.data,
          })
        : []

      ctx.status = 200
      ctx.body = {
        content: result.data,
        ...(warnings.length && { warnings }),
        ...metadata,
      }
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
  // shape (recipients: [{contactCode?, emailAddress}]). Logging preserves the
  // contactCode association when callers pass it.
  const SendBulkEmailSchema = z.object({
    emails: z.array(z.string()).optional(),
    recipients: z
      .array(
        z.object({
          contactCode: z.string().optional(),
          emailAddress: z.string(),
        })
      )
      .optional(),
    subject: z.string().min(1),
    text: z.string().min(1),
    logMeta: z
      .object({
        triggeredByUser: z.string().optional(),
        audienceCriteria: z.object({}).passthrough().optional(),
        templateId: z.string().uuid().optional(),
      })
      .optional(),
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
          contactCode?: string
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
          contactCode?: string
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

        // Strict but non-blocking: the email already went out, so a logging
        // failure must not fail the request (that would falsely report the send
        // as failed). Instead we log loudly for monitoring and surface a
        // non-blocking warning to the caller via `warnings`.
        const warnings: string[] = []
        try {
          await logOutboundDispatch({
            channel: 'email',
            fromAddress: EMAIL_SENDER,
            subject: body.subject,
            body: body.text,
            messageType: 'bulk_email',
            provider: EMAIL_PROVIDER,
            triggeredByUser: body.logMeta?.triggeredByUser,
            audienceCriteria: body.logMeta?.audienceCriteria,
            templateId: body.logMeta?.templateId,
            // TODO: log-before-send. Today we log after Infobip's 200 ACK, so an API
            // rejection leaves no audit row. Flip to: insert pending → call Infobip
            // → update to failed if rejected. Webhook still handles delivered/failed.
            recipients: validRecipients.map((r, i) => ({
              contactCode: r.contactCode,
              toAddress: r.emailAddress,
              externalMessageId: sendResult.data.messages?.[i]?.messageId,
              status: 'pending',
            })),
          })
        } catch (logError: any) {
          // Keep the warning generic for the client; the real error (which can
          // contain internal/DB detail) stays in logger.error only.
          warnings.push('Communication log failed')
          logger.error(
            { err: logError, messageType: 'bulk_email' },
            'Failed to write communication-log entry for bulk email'
          )
        }

        const successful = validRecipients.map((r) => r.emailAddress)
        ctx.status = 200
        ctx.body = {
          content: {
            successful,
            invalid: invalidEmails,
            totalSent: successful.length,
            totalInvalid: invalidEmails.length,
          },
          ...(warnings.length && { warnings }),
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
    typeof emailData.contactCode === 'string' &&
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
