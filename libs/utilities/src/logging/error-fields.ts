import { stdSerializers } from 'pino'

export const errorName = (err: unknown): string =>
  err instanceof Error ? err.name : typeof err

export const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err)

const pickDefined = (fields: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined))

const asString = (v: unknown) => (typeof v === 'string' ? v : undefined)

const asNumber = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined

export const serializeError = (err: unknown): unknown => {
  if (err === null || err === undefined) return err
  if (typeof err === 'string') return { message: err }
  if (typeof err !== 'object') return { message: String(err) }

  // Any non-null object may carry these fields; each is narrowed below.
  const e = err as Record<string, unknown>
  const withCauses = err instanceof Error ? stdSerializers.err(err) : undefined
  const response = e.response
  const responseStatus =
    typeof response === 'object' && response !== null && 'status' in response
      ? response.status
      : undefined
  const type =
    err instanceof Error ? (err.constructor?.name ?? err.name) : e.type
  return pickDefined({
    type: asString(type),
    message: asString(withCauses?.message ?? e.message),
    stack: asString(withCauses?.stack ?? e.stack),
    status: asNumber(e.status) ?? asNumber(responseStatus),
    // Elasticsearch maps a field by its first value; a numeric code would reject later string codes.
    code: e.code === undefined || e.code === null ? undefined : String(e.code),
  })
}

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
