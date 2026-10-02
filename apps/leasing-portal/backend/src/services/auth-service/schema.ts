import z from 'zod'

/** Errors this service produces itself. */
export const ErrorResponseBodySchema = z.object({
  error: z.string(),
})

/** Core's own error body, passed through unchanged. Core uses `message`, our middleware `error`. */
export const CoreErrorResponseBodySchema = z
  .object({
    error: z.string().optional(),
    message: z.string().optional(),
  })
  .passthrough()
