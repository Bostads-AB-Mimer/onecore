export const errorName = (err: unknown): string =>
  err instanceof Error ? err.name : typeof err

export const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err)

export const redactedMessage = (
  err: unknown,
  values: (string | null | undefined)[]
): string =>
  values
    .filter((v): v is string => !!v)
    .sort((a, b) => b.length - a.length)
    .reduce(
      (message, value) => message.split(value).join('[redacted]'),
      errorMessage(err)
    )
