import { communication } from '@onecore/types'
import { logger } from '@onecore/utilities'

import { db } from '../db'

type LogOutboundParams = communication.LogOutboundParams

/**
 * Persist an outbound communication event. Writes one `dispatch` row and one
 * `message_recipient` row per recipient inside a transaction. Returns the
 * generated dispatch id. Provider-agnostic: callers pass the provider name
 * and (if known) per-recipient externalMessageId for later webhook matching.
 */
export async function logOutboundDispatch(
  params: LogOutboundParams
): Promise<{ dispatchId: string }> {
  return db.transaction(async (trx) => {
    const [inserted] = await trx('dispatch')
      .insert({
        direction: 'outbound',
        channel: params.channel,
        fromAddress: params.fromAddress,
        subject: params.subject ?? null,
        body: params.body,
        messageType: params.messageType,
        provider: params.provider,
        triggeredByUser: params.triggeredByUser ?? null,
        recipientCount: params.recipients.length,
        audienceCriteria: params.audienceCriteria
          ? JSON.stringify(params.audienceCriteria)
          : null,
        templateId: params.templateId ?? null,
      })
      .returning<{ id: string }[]>('id')

    const dispatchId = inserted.id

    if (params.recipients.length > 0) {
      await trx('message_recipient').insert(
        params.recipients.map((r) => ({
          dispatchId,
          kundId: r.kundId ?? null,
          toAddress: r.toAddress,
          status: r.status ?? 'sent',
          externalMessageId: r.externalMessageId ?? null,
          error: r.error ?? null,
        }))
      )
    }

    logger.info(
      { dispatchId, recipientCount: params.recipients.length },
      'logged outbound dispatch'
    )

    return { dispatchId }
  })
}

/**
 * Update a recipient row's delivery status. Called from the Infobip webhook
 * handler when a delivery report arrives. Matches on the provider's
 * externalMessageId. Returns the number of rows updated (0 if no match —
 * e.g. webhook arrived for a dispatch we never logged).
 */
export async function updateRecipientStatusByExternalId(
  externalMessageId: string,
  status: communication.RecipientStatus,
  error?: string
): Promise<{ updatedCount: number }> {
  const updatedCount = await db('message_recipient')
    .where('externalMessageId', externalMessageId)
    .update({
      status,
      statusUpdatedAt: new Date(),
      error: error ?? null,
    })

  if (updatedCount === 0) {
    logger.warn(
      { externalMessageId },
      'no message_recipient found for external id'
    )
  }

  return { updatedCount }
}
