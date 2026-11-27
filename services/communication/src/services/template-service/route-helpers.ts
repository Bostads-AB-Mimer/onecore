import { TemplateValidationError } from './validation'

// Shared by the rep (index.ts) and system (system-routes.ts) template routes.
export const templateChanged = {
  error: 'TEMPLATE_CHANGED',
  message: 'Someone saved the template after it was loaded',
}

const VALIDATION_CODES =
  'UNKNOWN_PLACEHOLDER, MISSING_REQUIRED_PLACEHOLDER, PLACEHOLDER_NOT_ALONE, ' +
  'INVALID_URL, MISSING_PLACEHOLDER, INVALID_PLACEHOLDER_URL'
export const VALIDATION_DESCRIPTION = `400 with one of ${VALIDATION_CODES} when the template would fail or go out broken at send time.`

/** Runs the save validation; null (with the 400 answered) when it fails. */
export const runValidation = <T>(
  ctx: { status: number; body: unknown },
  validate: () => T
): T | null => {
  try {
    return validate()
  } catch (err: unknown) {
    if (!(err instanceof TemplateValidationError)) throw err
    ctx.status = 400
    ctx.body = { error: err.code, message: err.message }
    return null
  }
}
