import type { Context } from 'koa'

export const MAX_BATCH_RENTAL_OBJECT_CODES = 200

/**
 * Parse `rentalObjectCodes` from the query string. Accepts repeated params
 * and comma-separated values. Returns deduped, trimmed, non-empty codes.
 */
export function parseRentalObjectCodes(ctx: Context): string[] {
  const raw = ctx.query.rentalObjectCodes
  const values = Array.isArray(raw) ? raw : raw ? [raw] : []
  const codes = values
    .flatMap((v) => v.split(','))
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
  return [...new Set(codes)]
}
