import { z } from 'zod'
import { communication } from '@onecore/types'

type RecipientStatus = communication.RecipientStatus

// Field schemas for an Infobip delivery-report result. Defined here next to the
// mapper — the single source of truth for the report shape — and reused by the
// webhook route to validate the request body, so the validated payload and the
// mapper's input types can't drift apart.
export const InfobipStatusSchema = z.object({
  groupId: z.number().optional(),
  groupName: z.string(),
  id: z.number().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
})

// For a successful delivery Infobip sends groupName "OK"; for failures the error
// carries the detail that distinguishes a plain failure from a bounce.
// `groupName` is the error group (e.g. "USER_ERRORS" = recipient-side) and
// `permanent` flags a non-retryable failure.
export const InfobipErrorSchema = z.object({
  groupId: z.number().optional(),
  groupName: z.string().optional(),
  id: z.number().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  permanent: z.boolean().optional(),
})

export type InfobipStatus = z.infer<typeof InfobipStatusSchema>
export type InfobipError = z.infer<typeof InfobipErrorSchema>

// Infobip email bounces are NOT surfaced as a distinct status group — they
// arrive as groupName UNDELIVERABLE/REJECTED and are only identifiable from the
// error. Documented soft/hard/suppressed bounce codes (6011 = soft bounce,
// which is *transient* so it isn't caught by the permanent-flag rule below —
// hence kept here explicitly; 6012 = hard bounce; 6034 = EC_SUPPRESSED_BOUNCE).
// See https://www.infobip.com/docs/email/email-deliverability/email-delivery-errors.
const BOUNCE_ERROR_IDS = new Set<number>([6011, 6012, 6034])

/**
 * A delivery report counts as a bounce (vs a plain failure) when any holds:
 *  1. the error id is a documented bounce code, or
 *  2. the error text explicitly says "bounce", or
 *  3. it's a PERMANENT recipient-side failure — Infobip flags these
 *     `permanent: true` in the USER_ERRORS group (e.g. 6037 domain/MX not
 *     found, mailbox permanently unavailable). Rule 3 captures current and
 *     future hard bounces without enumerating every code.
 */
function isBounceError(error?: InfobipError): boolean {
  if (!error) return false
  if (error.id !== undefined && BOUNCE_ERROR_IDS.has(error.id)) return true
  if (/bounce/i.test(`${error.name ?? ''} ${error.description ?? ''}`)) {
    return true
  }
  return error.permanent === true && /USER_ERRORS/i.test(error.groupName ?? '')
}

/**
 * Map an Infobip delivery-report status to our `message_recipient.status`
 * enum. Pure — keep all mapping logic here so adjustments are a one-line edit
 * and fully unit-tested.
 *
 * Returns `null` for non-terminal states (PENDING): the webhook should leave
 * the existing row status untouched rather than overwrite it.
 */
export function mapInfobipStatus(
  status: InfobipStatus,
  error?: InfobipError
): RecipientStatus | null {
  switch (status.groupName?.toUpperCase()) {
    case 'DELIVERED':
      return 'delivered'
    case 'PENDING':
      // Not a terminal outcome — don't clobber the row, wait for the next report.
      return null
    case 'UNDELIVERABLE':
    case 'EXPIRED':
    case 'REJECTED':
      return isBounceError(error) ? 'bounced' : 'failed'
    default:
      // Unknown/new group: treat as a failure so it surfaces rather than being
      // silently dropped.
      return 'failed'
  }
}
