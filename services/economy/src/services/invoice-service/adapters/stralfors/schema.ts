import z from 'zod'

export const StralforsAccessTokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
})

export const StralforsPostChannelLookupResponseSchema = z.object({
  correlationId: z.string(),
})

export const StralforsGetChannelLookupResponseSchema = z.object({
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
    .array(),
})
