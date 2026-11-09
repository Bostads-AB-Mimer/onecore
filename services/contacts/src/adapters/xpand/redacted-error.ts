/**
 * A failed Xpand query, loggable without its message.
 *
 * Knex compiles the SQL with its bindings into `err.message` when a query
 * fails, so for a lookup by personnummer the message contains the number. The
 * stack starts with the message as well. This keeps what tells failures apart
 * (the error's name, the driver's code, where it was thrown) and drops the
 * rest: every stack line that is not a frame.
 */
export const redactedError = (
  err: unknown
): { err: { name: string; code?: unknown; stack?: string } } => {
  if (!(err instanceof Error)) return { err: { name: typeof err } }

  return {
    err: {
      name: err.name,
      code: 'code' in err ? err.code : undefined,
      stack: err.stack
        ?.split('\n')
        .filter((line) => line.trimStart().startsWith('at '))
        .join('\n'),
    },
  }
}
