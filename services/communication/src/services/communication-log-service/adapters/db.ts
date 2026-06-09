import knex from 'knex'
import { communication } from '@onecore/types'
import { logger } from '@onecore/utilities'

import Config from '../../../common/config'

export const createDbClient = () =>
  knex({
    client: 'mssql',
    connection: Config.communicationDatabase,
    pool: {
      min: 0,
      max: 20,
      idleTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
    },
  })

export const db = createDbClient()

type LogOutboundParams = communication.LogOutboundParams
type Dispatch = communication.Dispatch
type MessageRecipient = communication.MessageRecipient

export type DispatchWithRecipients = {
  dispatch: Dispatch
  recipients: MessageRecipient[]
}

export type CustomerMessage = {
  dispatch: Dispatch
  recipient: MessageRecipient
}

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

/**
 * Fetch a single dispatch and its recipients. Returns null when no dispatch
 * with that id exists.
 */
export async function getDispatchById(
  id: string
): Promise<DispatchWithRecipients | null> {
  const dispatch = await db<Dispatch>('dispatch').where('id', id).first()
  if (!dispatch) return null

  const recipients = await db<MessageRecipient>('message_recipient')
    .where('dispatchId', id)
    .orderBy('createdAt', 'asc')

  return { dispatch, recipients }
}

/**
 * Per-customer communication timeline: one row per message_recipient owned
 * by `kundId`, joined to its dispatch. Newest first. Direction-agnostic —
 * once inbound logging is added, replies surface here next to outbound
 * messages without query changes.
 */
export async function getCustomerMessages(
  kundId: string
): Promise<CustomerMessage[]> {
  const recipients = await db<MessageRecipient>('message_recipient').where(
    'kundId',
    kundId
  )

  if (recipients.length === 0) return []

  const dispatchIds = recipients.map((r) => r.dispatchId)
  const dispatches = await db<Dispatch>('dispatch').whereIn('id', dispatchIds)
  const byId = new Map(dispatches.map((d) => [d.id, d]))

  return recipients
    .map((recipient) => ({
      recipient,
      dispatch: byId.get(recipient.dispatchId),
    }))
    .filter((p): p is CustomerMessage => p.dispatch !== undefined)
    .sort(
      (a, b) =>
        new Date(b.dispatch.triggeredAt).getTime() -
        new Date(a.dispatch.triggeredAt).getTime()
    )
}
