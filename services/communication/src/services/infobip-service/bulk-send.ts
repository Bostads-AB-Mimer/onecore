// Shared orchestration for the bulk send routes (MIM-1897/MIM-1838). Owns
// the immediate-vs-scheduled split so the sms and email channels cannot
// drift: a scheduled send is only logged (our own worker sends it at its
// slot, see scheduled-sends/worker.ts); an immediate send calls the provider
// and logs afterwards with a non-blocking warning on log failure.
import { communication } from '@onecore/types'
import { logger } from '@onecore/utilities'

import { logOutboundDispatch } from '../communication-log-service/adapters/db'
import { SendAtEvaluation } from '../scheduled-sends/rules'

export type BulkRecipient = { contactCode?: string; toAddress: string }

// Both Infobip send responses (SMS v3, email v4) expose messages[i] aligned
// with the destinations array submitted.
export type BulkSendResponse = { messages?: Array<{ messageId: string }> }

export type RunBulkSendParams = {
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
  send: (toAddresses: string[]) => Promise<BulkSendResponse>
}

export type RunBulkSendOutcome =
  | { ok: false; reason: 'SCHEDULE_LOG_FAILED'; message: string }
  | {
      ok: true
      warnings: string[]
      schedule?: { dispatchId: string; sendAt: Date }
    }

export async function runBulkSend(
  params: RunBulkSendParams
): Promise<RunBulkSendOutcome> {
  const { messageType, recipients } = params

  const logParams = (
    status: 'scheduled' | 'pending',
    sendResult?: BulkSendResponse
  ): communication.LogOutboundParams => ({
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
      status,
    })),
  })

  // Scheduled: the dispatch row IS the schedule. Nothing reaches the provider
  // until the worker claims the rows at their slot.
  if (params.evaluation.kind === 'scheduled') {
    const { sendAt } = params.evaluation
    try {
      const { dispatchId } = await logOutboundDispatch({
        ...logParams('scheduled'),
        sendAt,
      })
      logger.info(
        {
          dispatchId,
          sendAt: sendAt.toISOString(),
          recipientCount: recipients.length,
          messageType,
        },
        'Scheduled bulk send'
      )
      return { ok: true, warnings: [], schedule: { dispatchId, sendAt } }
    } catch (logError: unknown) {
      logger.error(
        { err: logError, messageType },
        'Failed to write communication-log entry for scheduled bulk send — nothing was scheduled'
      )
      return {
        ok: false,
        reason: 'SCHEDULE_LOG_FAILED',
        message:
          'The scheduled send could not be logged. Nothing was sent — try again.',
      }
    }
  }

  const sendResult = await params.send(recipients.map((r) => r.toAddress))

  // Immediate send: the message already went out, so a logging failure must
  // not fail the request (that would falsely report the send as failed).
  // Warn non-blockingly; the real error stays in logger.error.
  const warnings: string[] = []
  try {
    await logOutboundDispatch(logParams('pending', sendResult))
  } catch (logError: unknown) {
    logger.error(
      { err: logError, messageType },
      'Failed to write communication-log entry for bulk send'
    )
    warnings.push('Communication log failed')
  }

  return { ok: true, warnings }
}
