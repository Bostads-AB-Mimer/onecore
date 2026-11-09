// Swedish text for the message-template error codes core forwards from the
// communication service (template CRUD and the /sendBulkSms precheck). Null
// for anything else so callers can fall back to other mappings.
export const templateErrorText = (code: unknown): string | null => {
  switch (code) {
    case 'TEMPLATE_NAME_TAKEN':
      return 'Det finns redan en mall med det namnet.'
    case 'TEMPLATE_NOT_FOUND':
      return 'Mallen finns inte längre. Välj en annan mall eller skicka utan mall.'
    case 'TEMPLATE_LOOKUP_FAILED':
      return 'Mallen kunde inte kontrolleras. Ingenting skickades — försök igen.'
    default:
      return null
  }
}

/** Pull the error code out of an openapi-fetch error body ({ error: code }). */
export const errorCodeOf = (error: unknown): string | undefined => {
  if (!error || typeof error !== 'object') return undefined
  // Cast: openapi-fetch types the error body as unknown; we only peek at one key.
  const code = (error as { error?: unknown }).error
  return typeof code === 'string' ? code : undefined
}
