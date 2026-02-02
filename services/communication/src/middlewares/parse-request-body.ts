import { ExtendableContext, Next, Request } from 'koa'
import { z, ZodRawShape } from 'zod'

type ContextWithParsedRequestBody<T> = ExtendableContext & {
  request: Request & { body: T }
}

export const parseRequestBody =
  <T extends ZodRawShape>(schema: z.ZodObject<T>) =>
  (ctx: ContextWithParsedRequestBody<z.infer<typeof schema>>, next: Next) => {
    const parseResult = schema.safeParse(ctx.request.body)
    if (!parseResult.success) {
      ctx.status = 400
      // TODO: Use error response type for this
      ctx.body = {
        status: 'error',
        data: parseResult.error.issues.map(({ message, path }) => ({
          message,
          path,
        })),
      }

      return
    }

    ctx.request.body = parseResult.data
    return next()
  }
