import { SubmitMiscellaneousInvoiceErrorCodes } from '@onecore/types'

import { SubmitMiscellaneousInvoiceError } from '@/services/api/core/economyService'

/**
 * What a failed submission means for the user.
 *
 * - `not-sent`: core definitely did not create the invoice, so the user may
 *   correct the form and send it again.
 * - `unknown`: the invoice may have been created (server error, network
 *   failure, timeout). Sending again could bill the tenant twice, so the user
 *   must check first.
 */
export type SubmitOutcome =
  { kind: 'not-sent'; message: string } | { kind: 'unknown' }

export function getSubmitOutcome(error: unknown): SubmitOutcome {
  if (!(error instanceof SubmitMiscellaneousInvoiceError)) {
    return { kind: 'unknown' }
  }

  switch (error.code) {
    case SubmitMiscellaneousInvoiceErrorCodes.CustomerCreationFailed:
      return {
        kind: 'not-sent',
        message:
          'Kunden kunde inte läggas upp i Xledger, så underlaget skickades inte. Kontakta ekonomiavdelningen.',
      }
    case SubmitMiscellaneousInvoiceErrorCodes.CustomerNotFoundAfterCreate:
      return {
        kind: 'not-sent',
        message:
          'Kunden har lagts upp i Xledger men syns inte där än, så underlaget skickades inte. Vänta en stund och skicka igen.',
      }
  }

  if (error.status === 401) {
    return {
      kind: 'not-sent',
      message:
        'Du är inte längre inloggad, så underlaget skickades inte. Logga in igen och skicka underlaget.',
    }
  }

  if (error.status === 403) {
    return {
      kind: 'not-sent',
      message:
        'Du saknar behörighet att skicka ströfakturaunderlag. Underlaget skickades inte.',
    }
  }

  // Any other 4xx means core rejected the request before anything was written
  if (error.status >= 400 && error.status < 500) {
    return {
      kind: 'not-sent',
      message:
        'Underlaget skickades inte. Kontrollera uppgifterna och försök igen.',
    }
  }

  return { kind: 'unknown' }
}
