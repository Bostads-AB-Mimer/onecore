import { GUIDE_IMAGE_MAX_DISPLAY } from '../constants'

/** The `error` code from a core API error body, or '' for unknown shapes. */
export function errorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'error' in error
    ? String((error as { error: unknown }).error)
    : ''
}

/** Message for a failed create/update of a guide. */
export function saveErrorMessage(error: unknown): string {
  const code = errorCode(error)
  if (code === 'slug-taken') {
    return 'Sluggen används redan av en annan guide. Välj en annan.'
  }
  if (code === 'category-not-found') {
    return 'Kategorin finns inte längre. Välj en annan kategori.'
  }
  if (code === 'image-not-in-step') {
    return 'En bild hör inte till det steg den skickades med. Ladda om guiden och försök igen.'
  }
  if (code === 'step-belongs-to-other-guide') {
    return 'Ett steg tillhör en annan guide. Ladda om guiden och försök igen.'
  }
  if (code === 'Validation failed') {
    return 'Något i guiden är ogiltigt. Kontrollera fälten och försök igen.'
  }
  return 'Guiden kunde inte sparas. Försök igen.'
}

/** Message for a failed image upload, keyed on the codes core rejects with. */
export function uploadErrorMessage(error: unknown, fileName: string): string {
  const reason = uploadReason(errorCode(error))
  return `${fileName}: ${reason}`
}

function uploadReason(code: string): string {
  switch (code) {
    case 'invalid-file-type':
      return 'filtypen stöds inte. Använd PNG, JPG eller WEBP.'
    case 'invalid-file-size':
      return `filen är för stor. Max ${GUIDE_IMAGE_MAX_DISPLAY}.`
    case 'invalid-file-data':
      return 'filen kunde inte läsas. Försök med en annan bild.'
    default:
      return 'kunde inte laddas upp. Försök igen.'
  }
}
