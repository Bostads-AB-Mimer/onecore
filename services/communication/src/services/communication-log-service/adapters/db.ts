import knex from 'knex'
import { Context } from 'koa'
import { communication } from '@onecore/types'
import { logger, paginateKnex, PaginatedResponse } from '@onecore/utilities'

import Config from '../../../common/config'
import { audienceCriteriaToRows } from '../audience-criteria'
import { deriveDispatchStatusFromCounts } from '../dispatch-status'

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

    // Persist the audience filter as normalized rows so the dispatch is
    // filterable by the scope it targeted (MIM-1911). Stored exactly as
    // selected — no hierarchy expansion.
    const audienceRows = audienceCriteriaToRows(params.audienceCriteria)
    if (audienceRows.length > 0) {
      await trx.raw(
        `
        INSERT INTO dispatch_audience_criterion (dispatchId, type, value)
        SELECT ?, j.type, j.value
        FROM OPENJSON(?) WITH (
          type VARCHAR(40) '$.type',
          value NVARCHAR(200) '$.value'
        ) j
      `,
        [dispatchId, JSON.stringify(audienceRows)]
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
  const query = db('message_recipient').where(
    'externalMessageId',
    externalMessageId
  )
  // A failure report for a never-sent cancelled message must not repaint a
  // deliberate cancel as 'failed'. Anything else (delivered, future statuses
  // like 'read') means the message really reached the recipient — let it win.
  if (status === 'failed' || status === 'bounced') {
    query.whereNot('status', 'cancelled')
  }

  const updatedCount = await query.update({
    status,
    statusUpdatedAt: new Date(),
    error: error ?? null,
  })

  if (updatedCount === 0) {
    logger.warn(
      { externalMessageId },
      'no updatable message_recipient found for external id'
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
  try {
    await db('dispatch').where('id', dispatchId).delete()
    logger.info({ dispatchId }, 'deleted dispatch')
  } catch (err) {
    logger.error(
      { err, dispatchId },
      'communication-log-adapter.deleteDispatch'
    )
    throw err
  }
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

  try {
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
  } catch (err) {
    logger.error(
      { err, dispatchId },
      'communication-log-adapter.setRecipientExternalIds'
    )
    throw err
  }
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
  try {
    const updatedCount = await db('message_recipient')
      .where({ dispatchId, status: 'scheduled' })
      .update({ status: 'cancelled', statusUpdatedAt: new Date() })

    logger.info({ dispatchId, updatedCount }, 'cancelled scheduled recipients')
    return { updatedCount }
  } catch (err) {
    logger.error(
      { err, dispatchId },
      'communication-log-adapter.cancelScheduledRecipients'
    )
    throw err
  }
}

/**
 * Update a dispatch's intended send time. Called after Infobip has confirmed
 * a reschedule; recipient statuses stay 'scheduled'.
 */
export async function updateDispatchSendAt(
  dispatchId: string,
  sendAt: Date
): Promise<{ updatedCount: number }> {
  try {
    const updatedCount = await db('dispatch')
      .where('id', dispatchId)
      .update({ sendAt })

    logger.info({ dispatchId, sendAt }, 'rescheduled dispatch')
    return { updatedCount }
  } catch (err) {
    logger.error(
      { err, dispatchId },
      'communication-log-adapter.updateDispatchSendAt'
    )
    throw err
  }
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

// Escape MSSQL LIKE metacharacters; used with `ESCAPE '\'`.
const escapeLike = (s: string) => s.replace(/[\\%_[]/g, (c) => `\\${c}`)

const AUTOMATIC_USER = 'Automatiskt utskick'

// Correlated EXISTS/NOT EXISTS predicates over message_recipient that reproduce
// deriveDispatchStatusFromCounts at the SQL level, so a status filter paginates
// correctly. `mr` is correlated to `dispatch.id`. These MUST stay in sync with
// the JS derivation — dispatch-status.test.ts asserts agreement for every
// status combination. Non-terminal (in-flight) statuses: pending/sent/received.
const STATUS_PREDICATE_SQL: Record<string, string> = {
  scheduled: `EXISTS (SELECT 1 FROM message_recipient mr WHERE mr.dispatchId = dispatch.id AND mr.status = 'scheduled')`,
  // all recipients cancelled
  cancelled: `EXISTS (SELECT 1 FROM message_recipient mr WHERE mr.dispatchId = dispatch.id)
     AND NOT EXISTS (SELECT 1 FROM message_recipient mr WHERE mr.dispatchId = dispatch.id AND mr.status <> 'cancelled')`,
  // not scheduled, and something still in flight
  sending: `NOT EXISTS (SELECT 1 FROM message_recipient mr WHERE mr.dispatchId = dispatch.id AND mr.status = 'scheduled')
     AND EXISTS (SELECT 1 FROM message_recipient mr WHERE mr.dispatchId = dispatch.id AND mr.status IN ('pending','sent','received'))`,
  // all recipients delivered
  delivered: `EXISTS (SELECT 1 FROM message_recipient mr WHERE mr.dispatchId = dispatch.id)
     AND NOT EXISTS (SELECT 1 FROM message_recipient mr WHERE mr.dispatchId = dispatch.id AND mr.status <> 'delivered')`,
  // all terminal, at least one delivered AND at least one non-delivered
  // (failed/bounced/cancelled) — includes the delivered+cancelled mix
  partially_delivered: `NOT EXISTS (SELECT 1 FROM message_recipient mr WHERE mr.dispatchId = dispatch.id AND mr.status IN ('scheduled','pending','sent','received'))
     AND EXISTS (SELECT 1 FROM message_recipient mr WHERE mr.dispatchId = dispatch.id AND mr.status = 'delivered')
     AND EXISTS (SELECT 1 FROM message_recipient mr WHERE mr.dispatchId = dispatch.id AND mr.status <> 'delivered')`,
  // all terminal, none delivered, at least one failed/bounced
  failed: `NOT EXISTS (SELECT 1 FROM message_recipient mr WHERE mr.dispatchId = dispatch.id AND mr.status IN ('scheduled','pending','sent','received','delivered'))
     AND EXISTS (SELECT 1 FROM message_recipient mr WHERE mr.dispatchId = dispatch.id AND mr.status IN ('failed','bounced'))`,
}

// Preserve filters in pagination _links. Dates are ISO-serialized; arrays are
// comma-joined and so don't round-trip through the array query params — that's
// acceptable because nothing consumes _links today.
function buildDispatchSearchLinkParams(
  params: communication.DispatchSearchQueryParams
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue
    out[k] =
      v instanceof Date
        ? v.toISOString()
        : Array.isArray(v)
          ? v.join(',')
          : String(v)
  }
  return out
}

/**
 * Paginated dispatch search. Filters on the dispatch row directly, on recipient
 * rows via EXISTS (contactCode, derived status), and on audience criteria via
 * EXISTS over dispatch_audience_criterion. Each returned dispatch is enriched
 * with a per-status recipient rollup, its derived status, and its audience
 * criteria. See MIM-1911.
 */
export async function searchDispatches(
  params: communication.DispatchSearchQueryParams,
  ctx: Context
): Promise<PaginatedResponse<communication.DispatchListItem>> {
  const query = db<Dispatch>('dispatch').select('dispatch.*')

  if (params.channel?.length) query.whereIn('dispatch.channel', params.channel)
  if (params.messageType?.length)
    query.whereIn('dispatch.messageType', params.messageType)
  if (params.triggeredByUser)
    query.where('dispatch.triggeredByUser', params.triggeredByUser)
  if (params.source === 'automatic')
    query.where('dispatch.triggeredByUser', AUTOMATIC_USER)
  if (params.source === 'manual')
    query
      .whereNot('dispatch.triggeredByUser', AUTOMATIC_USER)
      .whereNotNull('dispatch.triggeredByUser')
  if (params.sendAtFrom) query.where('dispatch.sendAt', '>=', params.sendAtFrom)
  if (params.sendAtTo) query.where('dispatch.sendAt', '<=', params.sendAtTo)
  if (params.minRecipients != null)
    query.where('dispatch.recipientCount', '>=', params.minRecipients)

  if (params.q) {
    const like = `%${escapeLike(params.q)}%`
    query.where((b) =>
      b
        .whereRaw("dispatch.body LIKE ? ESCAPE '\\'", [like])
        .orWhereRaw("dispatch.subject LIKE ? ESCAPE '\\'", [like])
    )
  }

  if (params.contactCode) {
    const contactCode = params.contactCode
    query.whereExists((b) =>
      b
        .select(db.raw('1'))
        .from('message_recipient as mr')
        .whereRaw('mr.dispatchId = dispatch.id')
        .where('mr.contactCode', contactCode)
    )
  }

  // Derived-status filter: OR the requested statuses' SQL predicates.
  const statuses = (params.status ?? []).filter((s) => STATUS_PREDICATE_SQL[s])
  if (statuses.length) {
    query.where((b) => {
      for (const s of statuses) b.orWhereRaw(`(${STATUS_PREDICATE_SQL[s]})`)
    })
  }

  // Audience code filters (exact membership on the criterion table).
  const audienceFilters: { type: string; values: string[] | undefined }[] = [
    { type: 'districtNames', values: params.audienceDistrictNames },
    { type: 'buildingCodes', values: params.audienceBuildingCodes },
    { type: 'areaCodes', values: params.audienceAreaCodes },
  ]
  for (const { type, values } of audienceFilters) {
    if (values?.length) {
      query.whereExists((b) =>
        b
          .select(db.raw('1'))
          .from('dispatch_audience_criterion as dac')
          .whereRaw('dac.dispatchId = dispatch.id')
          .where('dac.type', type)
          .whereIn('dac.value', values)
      )
    }
  }

  const SORT_COLUMNS: Record<string, string> = {
    sendAt: 'dispatch.sendAt',
    recipientCount: 'dispatch.recipientCount',
    createdAt: 'dispatch.createdAt',
  }
  const sortColumn =
    SORT_COLUMNS[params.sortBy ?? 'sendAt'] ?? 'dispatch.sendAt'
  // id tiebreaker: the sort columns are non-unique (many dispatches share a
  // sendAt/createdAt), and MSSQL OFFSET paging over a tied sort is
  // nondeterministic — without this rows can duplicate or vanish across pages.
  query
    .orderBy(sortColumn, params.sortOrder ?? 'desc')
    .orderBy('dispatch.id', 'asc')

  const page = await paginateKnex<Dispatch>(
    query,
    ctx,
    buildDispatchSearchLinkParams(params)
  )

  const ids = page.content.map((d) => d.id)
  const [rollupRows, criterionRows] = await Promise.all([
    ids.length
      ? db('message_recipient')
          .select('dispatchId', 'status')
          .count('* as count')
          .whereIn('dispatchId', ids)
          .groupBy('dispatchId', 'status')
      : Promise.resolve([]),
    ids.length
      ? db('dispatch_audience_criterion')
          .select('dispatchId', 'type', 'value')
          .whereIn('dispatchId', ids)
      : Promise.resolve([]),
  ])

  // Seed every dispatch's summary with all statuses at 0 so the runtime shape
  // matches the schema's record type (all keys present), then overlay counts.
  const zeroSummary = (): Record<communication.RecipientStatus, number> =>
    Object.fromEntries(
      communication.RECIPIENT_STATUS.map((s) => [s, 0])
    ) as Record<communication.RecipientStatus, number>

  const summaryByDispatch = new Map<
    string,
    Record<communication.RecipientStatus, number>
  >()
  for (const id of ids) summaryByDispatch.set(id, zeroSummary())
  for (const r of rollupRows as {
    dispatchId: string
    status: communication.RecipientStatus
    count: number
  }[]) {
    const summary = summaryByDispatch.get(r.dispatchId)
    if (summary) summary[r.status] = Number(r.count)
  }
  const audienceByDispatch = new Map<
    string,
    communication.AudienceCriterion[]
  >()
  for (const c of criterionRows as {
    dispatchId: string
    type: string
    value: string
  }[]) {
    const list = audienceByDispatch.get(c.dispatchId) ?? []
    list.push({ type: c.type, value: c.value })
    audienceByDispatch.set(c.dispatchId, list)
  }

  const content: communication.DispatchListItem[] = page.content.map((d) => {
    const statusSummary = summaryByDispatch.get(d.id) ?? zeroSummary()
    // Strip the legacy raw-JSON column from the list item.
    const { audienceCriteria: _legacy, ...rest } = d
    return {
      ...rest,
      status: deriveDispatchStatusFromCounts(statusSummary),
      statusSummary,
      audience: audienceByDispatch.get(d.id) ?? [],
    }
  })

  return { ...page, content }
}

/**
 * Paginated recipients of a single dispatch, optionally filtered by status or a
 * toAddress/contactCode substring. Use instead of the full dispatch-by-id read
 * for large bulks. See MIM-1911.
 */
export async function getDispatchRecipients(
  dispatchId: string,
  opts: { status?: string[]; q?: string },
  ctx: Context
): Promise<PaginatedResponse<MessageRecipient>> {
  const query = db<MessageRecipient>('message_recipient')
    .where('dispatchId', dispatchId)
    // id tiebreaker: all recipients of a bulk share createdAt (one insert), so
    // OFFSET paging over createdAt alone is nondeterministic across pages.
    .orderBy('createdAt', 'asc')
    .orderBy('id', 'asc')

  if (opts.status?.length) query.whereIn('status', opts.status)
  if (opts.q) {
    const like = `%${escapeLike(opts.q)}%`
    query.where((b) =>
      b
        .whereRaw("toAddress LIKE ? ESCAPE '\\'", [like])
        .orWhereRaw("contactCode LIKE ? ESCAPE '\\'", [like])
    )
  }

  return paginateKnex<MessageRecipient>(query, ctx)
}
