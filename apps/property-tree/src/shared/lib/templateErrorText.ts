// Swedish text for the message-template error codes core forwards from the
// communication service (template CRUD, save validation and the /sendBulkSms
// precheck). Null for anything else so callers can fall back to other mappings.
export const templateErrorText = (code: unknown): string | null => {
  switch (code) {
    case 'TEMPLATE_NAME_TAKEN':
      return 'Det finns redan en mall med det namnet.'
    case 'TEMPLATE_NOT_FOUND':
      return 'Mallen finns inte längre. Välj en annan mall eller skicka utan mall.'
    case 'TEMPLATE_LOOKUP_FAILED':
      return 'Mallen kunde inte kontrolleras. Ingenting skickades — försök igen.'
    case 'TEMPLATE_CHANGED':
      return 'Någon annan har sparat mallen medan du redigerade.'
    case 'SYSTEM_TEMPLATE_NOT_FOUND':
      return 'Mejlet finns inte.'
    case 'UNKNOWN_PLACEHOLDER':
      return 'Mallen har en platshållare som inte finns för den här mallen.'
    case 'MISSING_REQUIRED_PLACEHOLDER':
      return 'En platshållare som mejlet behöver saknas, till exempel meddelandet i ärendet.'
    case 'PLACEHOLDER_NOT_ALONE':
      return 'Meddelandet i ärendet måste stå ensamt i ett eget stycke, inte i en mening, tabell eller ämnesrad.'
    case 'INVALID_URL':
      return 'En adress är inte tillåten. Länkar ska börja med https://, mailto: eller tel: och bilder med https://.'
    case 'INVALID_PLACEHOLDER_URL':
      return 'En platshållare används som adress men är ingen adress.'
    case 'MISSING_PLACEHOLDER':
      return 'En platshållare saknar exempelvärde, så mallen kunde inte provas.'
    case 'SMS_TEXT_TOO_LONG':
      return 'SMS-texten är längre än 1 600 tecken.'
    case 'EMAIL_CONFIG_MISSING':
      return 'Organisationsuppgifterna för mejlen saknas, så förhandsgranskningen kan inte visas.'
    case 'INVALID_BODY':
      return 'Något fält är tomt eller för långt. Ämnesraden får inte ha radbrytningar.'
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
