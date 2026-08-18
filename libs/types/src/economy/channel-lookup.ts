import z from 'zod'

export const LookupRecipientTypeSchema = z.enum(['individual', 'organization'])

export const LookupRecipientSchema = z.object({
  recipientId: z.string(),
  recipientType: LookupRecipientTypeSchema,
})

export const ChannelLookupRequestBodySchema = z.object({
  recipients: LookupRecipientSchema.array(),
})

export const ChannelLookupResponseSchema = z.object({
  candidates: z
    .object({
      referenceId: z.string(),
      availableInChannels: z.string().array(),
      notAvailableInChannels: z.string().array(),
    })
    .array(),
  channelErrors: z
    .object({
      channel: z.string(),
      error: z.string(),
    })
    .array()
    .optional(),
})

export type LookupRecipientType = z.infer<typeof LookupRecipientTypeSchema>
export type LookupRecipient = z.infer<typeof LookupRecipientSchema>
export type ChannelLookupResponse = z.infer<typeof ChannelLookupResponseSchema>
