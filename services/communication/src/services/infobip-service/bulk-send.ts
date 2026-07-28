// Shared orchestration for the bulk send routes (MIM-1897). Owns the
// schedule/compensation sequence so the sms and email channels cannot drift:
// log-before-send for scheduled bulks, compensating delete when Infobip
// rejects the schedule, external-id backfill (scheduled) or log-after-send
// (immediate) with non-blocking warnings.
import { randomUUID } from 'node:crypto'
import { communication } from '@onecore/types'
import { logger } from '@onecore/utilities'

import {
  deleteDispatch,
  logOutboundDispatch,
  setRecipientExternalIds,
} from '../communication-log-service/adapters/db'
import { ScheduleOptions, SendAtEvaluation } from './schedule'

export type BulkRecipient = { contactCode?: string; toAddress: string }

// Both Infobip send responses (SMS v3, email v4) expose messages[i] aligned
// with the destinations array submitted.
export type BulkSendResponse = { messages?: Array<{ messageId: string }> }

export type RunScheduledBulkParams = {
  channel: communication.Channel
  messageType: 'bulk_sms' | 'bulk_email'
  fromAddress: string
  provider: string
  subject?: string
  body: string
  logMeta?: {
    triggeredByUser?: string
    audienceCriteria?: communication.LogOutboundParams['audienceCriteria']
    templateId?: string
  }
  // toAddress already validated/normalized by the route.
  recipients: BulkRecipient[]
  // Route-validated: 'invalid' has already been rejected with a 400.
  evaluation: Exclude<SendAtEvaluation, { kind: 'invalid' }>
  // Receives the address list derived from `recipients` (same order), so the
  // submitted destinations can't drift from the rows messages[i] is matched to.
  send: (
    toAddresses: string[],
    schedule?: ScheduleOptions
  ) => Promise<BulkSendResponse>
}

export type RunScheduledBulkOutcome =
  | { ok: false; reason: 'SCHEDULE_LOG_FAILED'; message: string }
  | {
      ok: true
      warnings: string[]
      schedule?: { bulkId: string; sendAt: Date }
    }

export async function runScheduledBulk(
  params: RunScheduledBulkParams
): Promise<RunScheduledBulkOutcome> {
  const { messageType, recipients } = params

  // Scheduled sends pre-generate the dispatch id: it doubles as the
  // Infobip bulkId (the cancel/reschedule handle).
  const schedule =
    params.evaluation.kind === 'scheduled'
      ? { bulkId: randomUUID(), sendAt: params.evaluation.sendAt }
      : undefined

  const logParams = (sendResult?: BulkSendResponse) => ({
    ...(schedule && {
      id: schedule.bulkId,
      sendAt: schedule.sendAt,
    }),
    channel: params.channel,
    fromAddress: params.fromAddress,
    subject: params.subject,
    body: params.body,
    messageType,
    provider: params.provider,
    triggeredByUser: params.logMeta?.triggeredByUser,
    audienceCriteria: params.logMeta?.audienceCriteria,
    templateId: params.logMeta?.templateId,
    recipients: recipients.map((r, i) => ({
      contactCode: r.contactCode,
      toAddress: r.toAddress,
      externalMessageId: sendResult?.messages?.[i]?.messageId,
      status: (schedule ? 'scheduled' : 'pending') as 'scheduled' | 'pending',
    })),
  })

  // Scheduled sends log BEFORE calling Infobip: the dispatch row is the
  // only cancel/reschedule handle, so it must exist whenever a schedule
  // exists. If the log write fails Infobip is never called; if Infobip
  // rejects, we undo our own row — compensating against our own DB
  // instead of a remote provider.
  if (schedule) {
    try {
      await logOutboundDispatch(logParams())
    } catch (logError) {
      logger.error(
        { err: logError, messageType },
        'Failed to write communication-log entry for scheduled bulk send — nothing was sent'
      )
      return {
        ok: false,
        reason: 'SCHEDULE_LOG_FAILED',
        message:
          'The scheduled send could not be logged. Nothing was sent — try again.',
      }
    }
    logger.info(
      {
        dispatchId: schedule.bulkId,
        sendAt: schedule.sendAt.toISOString(),
        recipientCount: recipients.length,
        messageType,
      },
      'Scheduling bulk send'
    )
  }

  let sendResult: BulkSendResponse
  try {
    sendResult = await params.send(
      recipients.map((r) => r.toAddress),
      schedule
    )
  } catch (sendError) {
    if (schedule) {
      try {
        await deleteDispatch(schedule.bulkId)
      } catch (deleteError) {
        // Worst case: a stale 'scheduled' row that never sends —
        // harmless next to a live unmanaged bulk, but log it.
        logger.error(
          { err: deleteError, dispatchId: schedule.bulkId },
          'Failed to delete dispatch after rejected schedule — stale scheduled row remains'
        )
      }
    }
    throw sendError
  }

  const warnings: string[] = []
  if (schedule) {
    // Backfill the provider message ids the log-before-send row lacks.
    // Best-effort: on failure only delivery-report matching degrades;
    // cancel/reschedule key on the dispatch id and are unaffected.
    try {
      await setRecipientExternalIds(
        schedule.bulkId,
        recipients.flatMap((r, i) => {
          const externalMessageId = sendResult.messages?.[i]?.messageId
          return externalMessageId
            ? [{ toAddress: r.toAddress, externalMessageId }]
            : []
        })
      )
    } catch (backfillError) {
      logger.error(
        { err: backfillError, dispatchId: schedule.bulkId },
        'Failed to backfill externalMessageIds — delivery reports will not match this dispatch'
      )
      warnings.push('Communication log is missing provider message ids')
    }
  } else {
    // Immediate send: the message already went out, so a logging failure
    // must not fail the request (that would falsely report the send as
    // failed). Warn non-blockingly; the real error stays in logger.error.
    try {
      await logOutboundDispatch(logParams(sendResult))
    } catch (logError) {
      logger.error(
        { err: logError, messageType },
        'Failed to write communication-log entry for bulk send'
      )
      warnings.push('Communication log failed')
    }
  }

  return { ok: true, warnings, schedule }
}
