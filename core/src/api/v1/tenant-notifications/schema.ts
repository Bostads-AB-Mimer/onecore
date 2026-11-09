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

// Error codes per status, so the integration can tell permanent (4xx) from
// retryable (502) failures from the spec alone.
export const SendLeaseTerminationConfirmationErrorCodes = {
  400: z.enum(['missing-idempotency-key', 'invalid-request']),
  404: z.enum(['lease-not-found']),
  409: z.enum(['idempotency-conflict', 'request-in-progress']),
  422: z.enum([
    'missing-end-date',
    'unsupported-rental-type',
    'contact-not-found',
    'no-recipient',
  ]),
  502: z.enum(['lease-lookup-failed', 'contact-lookup-failed', 'send-failed']),
}

const errorResponseBody = <T extends z.ZodTypeAny>(error: T) =>
  z.object({
    error,
    detail: z.string().optional(),
  })

export const SendLeaseTerminationConfirmationErrorResponseBodySchemas_APIv1 = {
  400: errorResponseBody(SendLeaseTerminationConfirmationErrorCodes[400]),
  404: errorResponseBody(SendLeaseTerminationConfirmationErrorCodes[404]),
  409: errorResponseBody(SendLeaseTerminationConfirmationErrorCodes[409]),
  422: errorResponseBody(SendLeaseTerminationConfirmationErrorCodes[422]),
  502: errorResponseBody(SendLeaseTerminationConfirmationErrorCodes[502]),
}
