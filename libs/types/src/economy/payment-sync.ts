import z from 'zod'

// Body of the economy service's 409 response when Tenfast refuses to record a
// payment against an invoice it has — for example a voided invoice, or a
// payment date in a locked accounting period. `reason` is Tenfast's message.
export const RecordPaymentRejectedResponseSchema = z.object({
  error: z.literal('payment-rejected'),
  reason: z.string(),
})

export type RecordPaymentRejectedResponse = z.infer<
  typeof RecordPaymentRejectedResponseSchema
>
