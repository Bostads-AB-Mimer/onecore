import KoaRouter from '@koa/router'
import { validator as phoneValidator, normalize } from 'telefonnummer'
import { ParkingSpaceOfferSms, WorkOrderSms, BulkSms } from '@onecore/types'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import z from 'zod'

import {
  sendParkingSpaceOfferSms,
  sendWorkOrderSms,
  sendBulkSms,
} from '../adapters/sms-adapter'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { logOutboundDispatch } from '../../communication-log-service/adapters/db'

// SMS sender used for fromAddress when logging outbound SMS dispatches.
// Mirrors the constant in sms-adapter.ts (kept private there).
const SMS_SENDER = 'Mimer'
// SMS runs through Tele2's procurement (same Infobip platform, but billed/auth'd via Tele2).
const SMS_PROVIDER = 'tele2'

export const MAX_BULK_SMS_RECIPIENTS = 15000

// Records a tenant-facing work-order SMS (sent from Odoo via /sendWorkOrderSms)
// in the communication log. Strict but non-blocking: the SMS already went out,
// so a logging failure must not fail the request. Instead we log loudly for
// monitoring and return a non-blocking warning the route surfaces via
// `warnings` (same shape as the bulk routes). Returns [] on success.
const logWorkOrderTenantSms = async (params: {
  to: string
  contactCode: string
  body: string
  triggeredByUser?: string
  sendResult: { messages?: Array<{ messageId: string }> }
}): Promise<string[]> => {
  try {
    await logOutboundDispatch({
      channel: 'sms',
      fromAddress: SMS_SENDER,
      body: params.body,
      messageType: 'work_order_tenant_sms',
      provider: SMS_PROVIDER,
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
      'Failed to write communication-log entry for work order tenant SMS'
    )
    return ['Communication log failed']
  }
}

/**
 * Extract a Swedish phone number from text that may contain names/labels.
 * Database entries like "Dottern Ingrid: 0700096176" should extract "0700096176".
 */
function extractPhoneNumber(input: string): string {
  const mobileMatch = input.match(/07\d{8}/)
  if (mobileMatch) return mobileMatch[0]

  const phoneMatch = input.match(/0\d[\d\s-]{6,12}/)
  if (phoneMatch) return phoneMatch[0].replace(/[\s-]/g, '')

  return input
}

// TODO: Migrate to OkapiRouter so these routes contribute to /swagger.
// Each handler needs `{}` (or a real schema) added as the second arg.
// See TODO in src/api.ts for the broader migration plan.
export const routes = (router: KoaRouter) => {
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

      // TODO: contactCode is TEMPORARILY OPTIONAL while older Odoo callers are
      // updated to send it. We only log the dispatch when it's present so the
      // row attaches to the customer timeline. Once every caller sends it,
      // make contactCode required and drop this `if`.
      const warnings = sms.contactCode
        ? await logWorkOrderTenantSms({
            to: phoneNumber,
            contactCode: sms.contactCode,
            body: sms.text,
            triggeredByUser: sms.triggeredByUser,
            sendResult: result,
          })
        : []

      ctx.status = 200
      ctx.body = {
        content: result,
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
  })

  // Accepts either the legacy shape (phoneNumbers: string[]) or the new
  // richer shape (recipients: [{contactCode?, phoneNumber}]). The recipient
  // count cap is enforced in the handler so we can return the existing
  // TOO_MANY_RECIPIENTS custom error format the UI already understands.
  const SendBulkSmsSchema = z.object({
    phoneNumbers: z.array(z.string()).optional(),
    recipients: z
      .array(
        z.object({
          contactCode: z.string().optional(),
          phoneNumber: z.string(),
        })
      )
      .optional(),
    text: z.string().min(1).max(1600),
    logMeta: z
      .object({
        triggeredByUser: z.string().optional(),
        audienceCriteria: z.object({}).passthrough().optional(),
        templateId: z.string().uuid().optional(),
      })
      .optional(),
  })
  type SendBulkSmsBody = z.infer<typeof SendBulkSmsSchema>

  router.post(
    '(.*)/sendBulkSms',
    parseRequestBody(SendBulkSmsSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)

      try {
        const body = ctx.request.body as SendBulkSmsBody

        const inputRecipients: Array<{
          contactCode?: string
          phoneNumber: string
        }> =
          body.recipients ??
          (body.phoneNumbers ?? []).map((p) => ({ phoneNumber: p }))

        if (inputRecipients.length > MAX_BULK_SMS_RECIPIENTS) {
          ctx.status = 400
          ctx.body = {
            reason: 'TOO_MANY_RECIPIENTS',
            message: `För många mottagare. Maximalt antal är ${MAX_BULK_SMS_RECIPIENTS.toLocaleString('sv-SE')}.`,
            maxRecipients: MAX_BULK_SMS_RECIPIENTS,
            requestedRecipients: inputRecipients.length,
            ...metadata,
          }
          return
        }

        if (inputRecipients.length === 0) {
          ctx.status = 400
          ctx.body = {
            reason: 'Must provide phoneNumbers or recipients',
            ...metadata,
          }
          return
        }

        // Validate and normalize phone numbers, preserving contactCode association.
        const validRecipients: Array<{
          contactCode?: string
          normalizedPhone: string
        }> = []
        const invalidPhones: string[] = []

        for (const r of inputRecipients) {
          const extracted = extractPhoneNumber(r.phoneNumber)
          if (phoneValidator(extracted)) {
            validRecipients.push({
              contactCode: r.contactCode,
              normalizedPhone: '46' + normalize(extracted).slice(1),
            })
          } else {
            invalidPhones.push(r.phoneNumber)
          }
        }

        if (validRecipients.length === 0) {
          ctx.status = 400
          ctx.body = {
            reason: 'No valid phone numbers',
            invalid: invalidPhones,
            ...metadata,
          }
          return
        }

        const sendResult = await sendBulkSms({
          phoneNumbers: validRecipients.map((r) => r.normalizedPhone),
          text: body.text,
        })

        // Strict: if logging fails the catch below turns it into a 500 even
        // though the SMS already went out. Better an audit-complete log path
        // with a noisy failure than a phantom send no one knows about.
        await logOutboundDispatch({
          channel: 'sms',
          fromAddress: SMS_SENDER,
          body: body.text,
          messageType: 'bulk_sms',
          provider: SMS_PROVIDER,
          triggeredByUser: body.logMeta?.triggeredByUser,
          audienceCriteria: body.logMeta?.audienceCriteria,
          templateId: body.logMeta?.templateId,
          // TODO: log-before-send. Today we log after Infobip's 200 ACK, so an API
          // rejection leaves no audit row. Flip to: insert pending → call Infobip
          // → update to failed if rejected. Webhook still handles delivered/failed.
          recipients: validRecipients.map((r, i) => ({
            contactCode: r.contactCode,
            toAddress: r.normalizedPhone,
            externalMessageId: sendResult.messages?.[i]?.messageId,
            status: 'pending',
          })),
        })

        const successful = validRecipients.map((r) => r.normalizedPhone)
        ctx.status = 200
        ctx.body = {
          content: {
            successful,
            invalid: invalidPhones,
            totalSent: successful.length,
            totalInvalid: invalidPhones.length,
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
