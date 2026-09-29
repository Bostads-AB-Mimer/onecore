import { Knex } from 'knex'

import { GuideRow } from './rows'

/**
 * guide.updatedAt doubles as the optimistic concurrency token for saves:
 * clients echo it back as expectedUpdatedAt. For that to work the value a
 * client reads must be exactly the value stored, and every change must move
 * it forward.
 */

/**
 * knex binds JS Dates as DATETIME (1/300 s precision), so a Date written to
 * the DATETIME2 column would be rounded on the way in. Binding the ISO string
 * and casting it keeps the exact millisecond, so the value read back equals
 * the value written.
 */
export const asDateTime2 = (db: Knex, date: Date): Knex.Raw =>
  db.raw('CAST(? AS DATETIME2(3))', [date.toISOString()])

/**
 * The next updatedAt: now, but always at least one millisecond after the
 * previous value, so two changes within the same millisecond (or a clock that
 * lags the stored value) still produce a different token.
 */
export const nextUpdatedAt = (previous: Date, now: Date = new Date()): Date =>
  new Date(Math.max(now.getTime(), previous.getTime() + 1))

/**
 * Compare at millisecond precision. The column is DATETIME2 (100 ns), but
 * clients only ever see the millisecond part through JSON, and rows written
 * by the column default (GETUTCDATE) may carry sub-millisecond digits.
 */
export const isSameUpdatedAt = (stored: Date, expected: string): boolean =>
  stored.getTime() === new Date(expected).getTime()

/**
 * Read a guide row with an update lock, so concurrent saves, uploads and
 * deletes on the same guide are serialized until the transaction ends.
 * Must be called inside a transaction.
 */
export const lockGuide = (
  guideId: string,
  trx: Knex.Transaction
): Promise<GuideRow | undefined> =>
  trx<GuideRow>('guide').where('id', guideId).forUpdate().first()

/**
 * Move a locked guide's updatedAt forward after its content changed outside
 * a full save (an image upload or delete). Returns the new value.
 */
export async function touchGuide(
  guide: GuideRow,
  trx: Knex.Transaction
): Promise<Date> {
  const updatedAt = nextUpdatedAt(guide.updatedAt)
  await trx('guide')
    .where('id', guide.id)
    .update({ updatedAt: asDateTime2(trx, updatedAt) })
  return updatedAt
}
