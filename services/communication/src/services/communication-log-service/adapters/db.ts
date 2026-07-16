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
 * dispatch id. Provider-agnostic: callers pass the provider name and (if
 * known) per-recipient externalMessageId for later webhook matching.
 * Scheduled sends pass an explicit `id` (it doubles as the provider bulkId)
 * and the target `sendAt`; both otherwise fall back to DB defaults.
 */
export async function logOutboundDispatch(
  params: LogOutboundParams
): Promise<{ dispatchId: string }> {
  return db.transaction(async (trx) => {
    const [inserted] = await trx('dispatch')
      .insert({
        ...(params.id && { id: params.id }),
        direction: 'outbound',
        channel: params.channel,
        fromAddress: params.fromAddress,
        subject: params.subject ?? null,
        body: params.body,
        messageType: params.messageType,
        provider: params.provider,
        triggeredByUser: params.triggeredByUser ?? null,
        ...(params.sendAt && { sendAt: params.sendAt }),
        recipientCount: params.recipients.length,
        audienceCriteria: params.audienceCriteria
          ? JSON.stringify(params.audienceCriteria)
          : null,
        templateId: params.templateId ?? null,
      })
      .returning<{ id: string }[]>('id')

    const dispatchId = inserted.id

    if (params.recipients.length > 0) {
      // Single INSERT ... SELECT FROM OPENJSON: the whole recipient list rides
      // in ONE bind parameter, sidestepping MSSQL's 2100-parameter cap that
      // would otherwise force chunked inserts (~10x slower at 15k rows) and
      // shrinking the window where the transaction's escalated lock blocks
      // delivery-report updates.
      // NOTE: the WITH clause duplicates the column types from migration
      // 202606081001_create_dispatch_tables.js — if a migration changes a
      // column, update it here too, or OPENJSON silently truncates values.
      await trx.raw(
        `
        INSERT INTO message_recipient
          (dispatchId, contactCode, toAddress, status, externalMessageId, error)
        SELECT ?, j.contactCode, j.toAddress, j.status, j.externalMessageId, j.error
        FROM OPENJSON(?) WITH (
          contactCode NVARCHAR(50) '$.contactCode',
          toAddress NVARCHAR(255) '$.toAddress',
          status VARCHAR(20) '$.status',
          externalMessageId NVARCHAR(100) '$.externalMessageId',
          error NVARCHAR(MAX) '$.error'
        ) j
      `,
        [
          dispatchId,
          JSON.stringify(
            params.recipients.map((r) => ({
              contactCode: r.contactCode ?? null,
              toAddress: r.toAddress,
              status: r.status ?? 'sent',
              externalMessageId: r.externalMessageId ?? null,
              error: r.error ?? null,
            }))
          ),
        ]
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
 * Remove a dispatch (recipients cascade). Used to undo the log-before-send
 * row of a scheduled dispatch when Infobip rejects the schedule — the
 * operation failed entirely, so no audit row should remain.
 */
export async function deleteDispatch(dispatchId: string): Promise<void> {
  await db('dispatch').where('id', dispatchId).delete()
  logger.info({ dispatchId }, 'deleted dispatch')
}

/**
 * Backfill provider message ids onto a dispatch's recipients after a
 * log-before-send flow (scheduled sends log first, so the ids from Infobip's
 * response arrive later). Single statement via OPENJSON to stay well under
 * MSSQL's parameter cap for large bulks. Matches on toAddress; if two
 * recipients share an address they get the same id, which delivery-report
 * matching tolerates.
 */
export async function setRecipientExternalIds(
  dispatchId: string,
  pairs: { toAddress: string; externalMessageId: string }[]
): Promise<void> {
  if (pairs.length === 0) return

  await db.raw(
    `
    UPDATE mr SET externalMessageId = j.externalMessageId
    FROM message_recipient mr
    JOIN OPENJSON(?) WITH (
      toAddress NVARCHAR(255) '$.toAddress',
      externalMessageId NVARCHAR(100) '$.externalMessageId'
    ) j ON j.toAddress = mr.toAddress
    WHERE mr.dispatchId = ?
  `,
    [JSON.stringify(pairs), dispatchId]
  )

  logger.info(
    { dispatchId, pairCount: pairs.length },
    'backfilled recipient external ids'
  )
}

/**
 * Mark every still-'scheduled' recipient of a dispatch as 'cancelled'.
 * Called after Infobip has confirmed the bulk cancellation, so rows that a
 * delivery report already moved past 'scheduled' are left untouched.
 * Returns the number of rows updated.
 */
export async function cancelScheduledRecipients(
  dispatchId: string
): Promise<{ updatedCount: number }> {
  const updatedCount = await db('message_recipient')
    .where({ dispatchId, status: 'scheduled' })
    .update({ status: 'cancelled', statusUpdatedAt: new Date() })

  logger.info({ dispatchId, updatedCount }, 'cancelled scheduled recipients')
  return { updatedCount }
}

/**
 * Update a dispatch's intended send time. Called after Infobip has confirmed
 * a reschedule; recipient statuses stay 'scheduled'.
 */
export async function updateDispatchSendAt(
  dispatchId: string,
  sendAt: Date
): Promise<{ updatedCount: number }> {
  const updatedCount = await db('dispatch')
    .where('id', dispatchId)
    .update({ sendAt })

  logger.info({ dispatchId, sendAt }, 'rescheduled dispatch')
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
 * by `contactCode`, joined to its dispatch. Newest first. Direction-agnostic —
 * once inbound logging is added, replies surface here next to outbound
 * messages without query changes.
 */
export async function getCustomerMessages(
  contactCode: string
): Promise<CustomerMessage[]> {
  const recipients = await db<MessageRecipient>('message_recipient').where(
    'contactCode',
    contactCode
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
        new Date(b.dispatch.sendAt).getTime() -
        new Date(a.dispatch.sendAt).getTime()
    )
}
