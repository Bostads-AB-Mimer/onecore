import { Context } from 'koa'
import { z, ZodSchema } from 'zod'

export type ContextWithParsedRequestBody<T extends ZodSchema> = Context & {
  request: Context['request'] & { body: z.infer<T> }
}

/**
 * Wraps a route handler so its request body is validated and typed.
 *
 * This is a composing wrapper rather than a middleware because OkapiRouter
 * accepts a single handler per route. Its `body` schema is used only to
 * generate the OpenAPI document and to infer types — it performs no runtime
 * validation, the same limitation already documented for query parameters in
 * the contacts routes. Without this, an unvalidated body would reach the
 * handler typed as if it had been checked.
 */
export const withParsedBody =
  <T extends ZodSchema>(
    schema: T,
    handler: (ctx: ContextWithParsedRequestBody<T>) => Promise<void>
  ) =>
  async (ctx: ContextWithParsedRequestBody<T>) => {
    const parsed = schema.safeParse(ctx.request.body)

    if (!parsed.success) {
      ctx.status = 400
      ctx.body = {
        error: 'invalid-request-body',
        issues: parsed.error.issues.map(({ message, path }) => ({
          message,
          path,
        })),
      }
      return
    }

    ctx.request.body = parsed.data
    await handler(ctx)
  }
