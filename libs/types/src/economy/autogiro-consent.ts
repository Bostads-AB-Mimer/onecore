import z from 'zod'

// No schema for this in Tenfast docs currently, this is guesswork based on response
// TODO Trim to contain only properties that we actually use
export const AutogiroConsentSchema = z.object({
  _id: z.string(),
  hyresgast: z.string(),
  hyresvardBankgiro: z.string(),
  payerNumber: z.number(),
  fixedDueDay: z.coerce.date().nullable(), // TODO is this a date string?
  isCompany: z.boolean(),
  payerSSN: z.string(),
  status: z.enum(['ACTIVE', 'MANUAL']), // TODO are there more possible statuses?
  statusChangedAt: z.coerce.date(),
  extra: z.object({
    nameAndAddress1: z.string(),
    mismatch: z.string().nullable(), // TODO is this a string?
  }),
  payerBankAccountNumber: z.string(),
})

export type AutogiroConsent = z.infer<typeof AutogiroConsentSchema>
