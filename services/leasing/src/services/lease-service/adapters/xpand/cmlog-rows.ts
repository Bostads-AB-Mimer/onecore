import { Knex } from 'knex'

/**
 * Reads cmlog rows whose logmemo matches every pattern, after `since` or all
 * of them when it is null, oldest first.
 *
 * cmlog.logtime is a naive SQL Server `datetime` populated by xpand with
 * Swedish local time. Knex/mssql passes our JS Date as UTC; the driver
 * converts to the SQL Server session's local time for comparison. On a
 * machine running in Sweden this matches the column's wall clock, so the
 * `since` threshold lands where it reads.
 *
 * logtime has whole-second precision; keycmlog starts with an encoded time
 * and orders rows within one second.
 */
export const cmlogRowsSince = (
  db: Knex,
  since: Date | null,
  likePatterns: string[]
): Promise<{ logmemo: string; logtime: Date }[]> => {
  const base = likePatterns
    .reduce(
      (query, pattern) => query.andWhereLike('logmemo', pattern),
      db.from('cmlog')
    )
    .orderBy([
      { column: 'logtime', order: 'asc' },
      { column: 'keycmlog', order: 'asc' },
    ])
    .select('logmemo', 'logtime')

  return since ? base.andWhere('logtime', '>', since) : base
}

/**
 * Parses a `since` query value: null when absent, undefined when not a date.
 */
export const parseSinceQuery = (value: unknown): Date | null | undefined => {
  if (!value) return null
  const since = new Date(value as string)
  return isNaN(since.getTime()) ? undefined : since
}
