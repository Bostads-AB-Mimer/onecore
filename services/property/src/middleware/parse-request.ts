import { Next, ParameterizedContext } from 'koa'
import { z } from 'zod'

export function parseRequest<T extends z.ZodType, Q extends z.ZodType>(params: {
  body?: T
  query?: Q
}) {
  return function (ctx: ParameterizedContext, next: Next) {
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
      ctx.state.parsedBody = parseResult.data
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
      ctx.state.parsedQuery = parseResult.data
    }

    return next()
  }
}
