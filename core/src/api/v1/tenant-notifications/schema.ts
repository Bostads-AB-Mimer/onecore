import { z } from 'zod'
import { LeaseTerminationConfirmationRequestSchema } from '@onecore/types'

export const SendLeaseTerminationConfirmationRequestBodySchema =
  LeaseTerminationConfirmationRequestSchema

export const SendLeaseTerminationConfirmationResponseBodySchema_APIv1 = z
  .object({
    _links: z.any(),
  })
  .extend({
    content: z.object({
      sent: z.literal(true),
    }),
  })

export const SendLeaseTerminationConfirmationErrorResponseBodySchema_APIv1 =
  z.object({
    error: z.string(),
    detail: z.string().optional(),
  })
