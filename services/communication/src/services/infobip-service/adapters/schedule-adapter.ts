// fetch is stable in Node.js 20 LTS but eslint-plugin-n still flags it as experimental
/* eslint-disable n/no-unsupported-features/node-builtins */
// Manages Infobip scheduled bulks (MIM-1897): cancel and reschedule. The
// bulkId is always our dispatch id — the send routes set it via
// options.schedule when a bulk send is scheduled.
import { logger } from '@onecore/utilities'

import config from '../../../common/config'

// SMS runs through the Tele2-procured Infobip account, email through the
// Mimer account — credentials and base URL follow the channel.
const channelApi = (channel: 'sms' | 'email') => {
  const { baseUrl, apiKey } = channel === 'sms' ? config.tele2 : config.infobip
  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey }
}

// Infobip refused to touch the bulk — typically because it already fired
// (PROCESSING/FINISHED) or the bulkId is unknown to it. Routes map this to
// 409 so the client can distinguish "too late" from a server fault.
export class ScheduledBulkConflictError extends Error {
  constructor(
    public readonly status: number,
    body: string
  ) {
    super(`Infobip rejected scheduled-bulk update: ${status} - ${body}`)
    this.name = 'ScheduledBulkConflictError'
  }
}

const putBulk = async (
  channel: 'sms' | 'email',
  path: '/1/bulks' | '/1/bulks/status',
  bulkId: string,
  body: Record<string, string>
): Promise<void> => {
  const { baseUrl, apiKey } = channelApi(channel)
  const url = `${baseUrl}/${channel}${path}?bulkId=${encodeURIComponent(bulkId)}`

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `App ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    logger.error(
      { channel, bulkId, status: response.status, errorBody },
      'Infobip scheduled-bulk update failed'
    )
    // 401/403 is an account-permission problem (the Tele2-procured key lacks
    // bulk-management PUT rights until enabled), not a bulk-state conflict —
    // surface as a server fault so it alarms instead of reading as "too late".
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `Infobip scheduled-bulk API unauthorized — the ${channel} account ` +
          `lacks bulk-management permissions: ${response.status} - ${errorBody}`
      )
    }
    if (response.status >= 400 && response.status < 500) {
      throw new ScheduledBulkConflictError(response.status, errorBody)
    }
    throw new Error(
      `Infobip scheduled-bulk API error: ${response.status} - ${errorBody}`
    )
  }
}

// PUT /{channel}/1/bulks/status — flips the bulk to CANCELED so it never sends.
export async function cancelScheduledBulk(
  channel: 'sms' | 'email',
  bulkId: string
): Promise<void> {
  await putBulk(channel, '/1/bulks/status', bulkId, { status: 'CANCELED' })
  logger.info({ channel, bulkId }, 'cancelled scheduled bulk at Infobip')
}

// Moves the bulk's send time. Infobip only reschedules PAUSED bulks — a
// PENDING bulk gets 404 "No bulks eligible for rescheduling" (undocumented;
// verified live 2026-07-14) — so the sequence is pause -> move -> resume.
export async function rescheduleScheduledBulk(
  channel: 'sms' | 'email',
  bulkId: string,
  sendAt: Date
): Promise<void> {
  await putBulk(channel, '/1/bulks/status', bulkId, { status: 'PAUSED' })

  let rescheduleError: unknown
  try {
    await putBulk(channel, '/1/bulks', bulkId, {
      sendAt: sendAt.toISOString(),
    })
  } catch (error) {
    rescheduleError = error
  }

  // Always resume: a bulk left PAUSED never sends. If resuming fails the
  // bulk IS stranded — log at error level and fail the request loudly.
  try {
    await putBulk(channel, '/1/bulks/status', bulkId, { status: 'PENDING' })
  } catch (resumeError) {
    logger.error(
      { channel, bulkId, err: resumeError },
      'failed to resume bulk after reschedule — bulk is PAUSED at Infobip and will not send until resumed'
    )
    throw (
      rescheduleError ??
      new Error(
        `Bulk ${bulkId} rescheduled but left PAUSED at Infobip — resume manually`
      )
    )
  }

  if (rescheduleError) throw rescheduleError

  logger.info(
    { channel, bulkId, sendAt: sendAt.toISOString() },
    'rescheduled bulk at Infobip'
  )
}
