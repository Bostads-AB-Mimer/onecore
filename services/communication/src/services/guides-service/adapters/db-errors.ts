// MSSQL/tedious error numbers for a unique constraint violation:
// 2601 is a unique index, 2627 a unique/primary key constraint.
const UNIQUE_VIOLATION_NUMBERS = [2601, 2627]

/**
 * True when the error comes from a unique index or constraint. Used to turn
 * the race between "is this slug free?" and the actual insert into a proper
 * domain error instead of a 500.
 */
export const isUniqueViolation = (err: unknown): boolean => {
  const errorNumber = (candidate: unknown): number | undefined => {
    if (typeof candidate !== 'object' || candidate === null) return undefined
    const { number } = candidate as { number?: unknown }
    return typeof number === 'number' ? number : undefined
  }

  if (typeof err !== 'object' || err === null) return false
  // knex wraps the tedious error, which keeps the number on originalError.
  const { originalError } = err as { originalError?: unknown }
  return [errorNumber(err), errorNumber(originalError)].some(
    (number) =>
      number !== undefined && UNIQUE_VIOLATION_NUMBERS.includes(number)
  )
}

/**
 * True when the unique violation comes from one of the named indexes or
 * constraints. MSSQL names the index in the message: 2601 reads
 * "Cannot insert duplicate key row ... with unique index 'uq_guide_slug'" and
 * 2627 "Violation of UNIQUE KEY constraint 'uq_guide_slug'". Used so a
 * violation on an unrelated index is not mistaken for a slug conflict.
 */
export const isUniqueViolationOn = (
  err: unknown,
  indexNames: string[]
): boolean => {
  if (!isUniqueViolation(err)) return false

  const message = (candidate: unknown): string => {
    if (typeof candidate !== 'object' || candidate === null) return ''
    const { message } = candidate as { message?: unknown }
    return typeof message === 'string' ? message : ''
  }

  const { originalError } = err as { originalError?: unknown }
  const text = `${message(err)} ${message(originalError)}`
  return indexNames.some((name) => text.includes(`'${name}'`))
}
