import z from 'zod'

export const StralforsAccessTokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
})

export const StralforsPostChannelLookupResponseSchema = z.object({
  correlationId: z.string(),
})

export const StralforsGetChannelLookupResponseSchema = z.object({
  customerId: z.string().nullable().optional(),
  subCustomerId: z.string().nullable().optional(),
  results: z
    .object({
      channel: z.enum(['Kivra', 'Billo', 'eInvoiceB2C', 'eInvoiceB2B']),
      matchedCandidates: z.string().array().nullable(),
      error: z.string().nullable(),
    })
    .array()
    .nullable()
    .optional(),
})
