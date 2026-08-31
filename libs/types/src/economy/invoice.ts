import z from 'zod'

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/

export const DeferralErrorCodes = [
  'invoice-not-found',
  'invoice-not-eligible',
  'xledger-failed',
  'tenfast-failed',
] as const

export type DeferralErrorCode = (typeof DeferralErrorCodes)[number]

export function isDeferralErrorCode(
  value: unknown
): value is DeferralErrorCode {
  return DeferralErrorCodes.some((code) => code === value)
}

export const XledgerDeferralRequestSchema = z.object({
  endDate: z.string().regex(isoDateRegex, 'endDate must be YYYY-MM-DD'),
})

export const DeferralRequestSchema = z.object({
  endDate: z.string().regex(isoDateRegex, 'endDate must be YYYY-MM-DD'),
  reason: z.string().min(1, 'reason is required'),
})

export const TenfastGracePeriodRequestSchema = z.object({
  endDate: z.string().regex(isoDateRegex, 'endDate must be YYYY-MM-DD'),
  madeByEmail: z.string().email(),
  reason: z.string().min(1, 'reason is required'),
})

/** Request body for economy's internal deferral use-case. */
export const EconomyDeferralRequestSchema = TenfastGracePeriodRequestSchema

export const GetInvoicesByContactCodeQueryParams = z
  .object({ from: z.coerce.date().optional() })
  .optional()

export const GetUnpaidInvoicesQueryParams = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
})

export const GetInvoicesQueryParams = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    remainingAmountGreaterThan: z.coerce.number().optional(),
    after: z.string().optional(),
    pageSize: z.coerce.number().optional(),
  })
  .optional()
