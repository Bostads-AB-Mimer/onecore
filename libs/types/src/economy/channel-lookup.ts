import z from 'zod'

export const ChannelLookupRequestBodySchema = z.object({
  nationalRegistrationNumbers: z.string().array(),
})

const ChannelLookupChannelSchema = z.enum(['Kivra', 'eInvoiceB2C']) // Other possible values are 'Billo' and 'eInvoiceB2B' but they are not used currently

export const ChannelLookupSchema = z.object({
  channel: ChannelLookupChannelSchema,
  matchedCandidates: z.string().array().nullable(),
  error: z.string().nullable(),
})

export const ChannelLookupResponseSchema = z.array(ChannelLookupSchema)

export type ChannelLookup = z.infer<typeof ChannelLookupSchema>
export type ChannelLookupResponse = z.infer<typeof ChannelLookupResponseSchema>
export type ChannelLookupChannel = z.infer<typeof ChannelLookupChannelSchema>
