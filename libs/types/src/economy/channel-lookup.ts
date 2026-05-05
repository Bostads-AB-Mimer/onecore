import z from 'zod'

export const ChannelLookupRequestBodySchema = z.object({
  contactCodes: z.string().array(),
})

export const ChannelLookupSchema = z.object({
  channel: z.enum(['Kivra', 'Billo', 'eInvoiceB2C', 'eInvoiceB2B']),
  matchedCandidates: z.string().array().nullable(),
  error: z.string().nullable(),
})

export type ChannelLookup = z.infer<typeof ChannelLookupSchema>
