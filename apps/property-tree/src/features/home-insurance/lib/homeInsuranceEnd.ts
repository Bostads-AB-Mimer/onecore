import { format } from 'date-fns'
import { z } from 'zod'

// apiError, not baseApi: it has no side effects, so this file stays pure.
import { ApiError } from '@/services/api/core/apiError'
import type {
  EndHomeInsuranceRowBody,
  HomeInsuranceRow,
} from '@/services/api/core/homeInsuranceService'

export type EndAction = EndHomeInsuranceRowBody['action']
type PlanError = 'end-date-before-start' | 'end-date-unchanged'

/**
 * What the backend will do with the row: the same rules as
 * planHomeInsuranceEnd in leasing, so the dialog can say so before saving.
 * Days are compared as yyyy-mm-dd strings, never as Dates. The backend
 * decides; this only guides.
 */
export function planEnd(
  row: Pick<HomeInsuranceRow, 'from' | 'to'>,
  endDate: string,
  action: EndAction
): 'delete' | 'replace' | PlanError {
  if (action === 'cancel' && row.from && endDate <= row.from) return 'delete'
  if (action === 'set-end' && row.from && endDate < row.from)
    return 'end-date-before-start'
  if (row.to === endDate) return 'end-date-unchanged'
  return 'replace'
}

/** The picked calendar day as yyyy-mm-dd, in the user's own time zone. */
export const toDay = (date: Date) => format(date, 'yyyy-MM-dd')

const planErrorMessages: Record<PlanError, string> = {
  'end-date-before-start':
    'T.o.m. kan inte vara före försäkringens Fr.o.m. Välj "Säg upp" för att ta bort raden.',
  'end-date-unchanged': 'Försäkringen slutar redan det datumet.',
}

export const endHomeInsuranceFormSchema = (
  row: Pick<HomeInsuranceRow, 'from' | 'to'>
) =>
  z
    .object({
      action: z.enum(['cancel', 'set-end']),
      endDate: z.date({ required_error: 'Välj ett datum' }),
    })
    .superRefine((values, ctx) => {
      const plan = planEnd(row, toDay(values.endDate), values.action)
      if (plan === 'end-date-before-start' || plan === 'end-date-unchanged')
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endDate'],
          message: planErrorMessages[plan],
        })
    })

export type EndHomeInsuranceFormValues = z.infer<
  ReturnType<typeof endHomeInsuranceFormSchema>
>

const codeMessages: Record<string, string> = {
  ...planErrorMessages,
  'lease-not-found': 'Kontraktet hittades inte.',
  'home-insurance-row-not-found': 'Kontraktet har ingen hemförsäkring.',
  // Says whose change stands: the other one. The rows are reloaded after
  // every attempt, so the list already shows the row as it is now.
  'home-insurance-row-changed':
    'Din ändring sparades inte: någon annan hade ändrat raden innan. Listan visar nu raden som den är.',
  // upstream-failed can also mean the write went through but could not be
  // checked afterwards, and unknown that leasing answered unexpectedly or not
  // at all: either way the row may have changed.
  'upstream-failed':
    'Hyressystemet svarade inte som väntat. Ändringen kan ha sparats – kontrollera raden innan du försöker igen.',
  unknown:
    'Något gick fel. Ändringen kan ha sparats – kontrollera raden innan du försöker igen.',
}

/** A Swedish message for a failed PATCH. Never the server's own text. */
export function endHomeInsuranceErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Något gick fel.'
  if (error.code && codeMessages[error.code]) return codeMessages[error.code]
  if (error.status === 400)
    return 'Uppgifterna är ogiltiga. Kontrollera datumet.'
  if (error.status === 403)
    return 'Du har inte behörighet att ändra hemförsäkringar.'
  if (error.status === 409) return codeMessages['home-insurance-row-changed']
  return 'Något gick fel.'
}
