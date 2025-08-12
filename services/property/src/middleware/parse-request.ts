import { ExtendableContext, Next, Request } from 'koa'
import { z } from 'zod'

type ContextWithParsedRequestBody<T, Q> = ExtendableContext & {
  request: Request & {
    parsedBody: z.infer<T>
    parsedQuery: z.infer<Q>
  }
}
export function parseRequest<
  T extends z.ZodTypeAny,
  Q extends z.ZodTypeAny,
>(params: { body?: T; query?: Q }) {
  return function (ctx: ContextWithParsedRequestBody<T, Q>, next: Next) {
    if (params.body) {
      const parseResult = params.body.safeParse(ctx.request.body)
      if (!parseResult.success) {
        ctx.status = 400
        ctx.body = {
          status: 'error with request body',
          data: parseResult.error.issues.map(({ message, path }) => ({
            message,
            path,
          })),
        }
        return
      }
      ctx.request.parsedBody = parseResult.data
    }

    if (params.query) {
      const parseResult = params.query.safeParse(ctx.request.query)
      if (!parseResult.success) {
        ctx.status = 400
        ctx.body = {
          status: 'error with request query',
          data: parseResult.error.issues.map(({ message, path }) => ({
            message,
            path,
          })),
        }
        return
      }
      ctx.request.parsedQuery = parseResult.data
    }

    return next()
  }
}
