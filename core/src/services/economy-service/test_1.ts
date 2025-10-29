import KoaRouter from '@koa/router'
import {
  generateRouteMetadata,
  makeSuccessResponseBody,
} from '@onecore/utilities'

import z from 'zod'
import { Context } from 'koa'

export type RouteSpecInput = {
  body?: z.ZodTypeAny
  params?: z.ZodTypeAny
  query?: z.ZodTypeAny
}

export type RouteSpecOutput = { [key: number]: z.ZodTypeAny }

type RouteSpec = {
  name: string
  method: 'get' | 'post' | 'put' | 'delete'
  path: string
  description: string
  input?: RouteSpecInput
  output?: RouteSpecOutput
}

export function createRouteSpec<R extends RouteSpec>(spec: R) {
  return spec
}

type ExpectedReturnType<O> = {
  [K in keyof O & number]: {
    status: K
    data: O[K] extends z.ZodTypeAny ? z.infer<O[K]> : never
  }
}

export function routeHandler<
  I extends RouteSpecInput,
  O extends RouteSpecOutput,
  S extends keyof O & number,
>(
  spec: { input?: I; output: O },
  handler: (ctx: Context) => Promise<ExpectedReturnType<O>[S]>
) {
  return async (ctx: Context) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await Promise.resolve(handler(ctx))
    const schema = spec.output[result.status]
    const parsed = schema.safeParse(result.data)

    if (!parsed.success) {
      ctx.status = 500
      ctx.body = { error: 'Response validation failed' }
      return
    }

    ctx.status = result.status
    ctx.body = makeSuccessResponseBody(result.data, metadata)
  }
}

const UserSchema = z.object({ name: z.string() })
const OneCoreGenericErrorSchema = z.object({ error: z.string() })

const route = createRouteSpec({
  name: 'get-user',
  description: 'Get a user by ID',
  method: 'get',
  path: '/users/:userId',
  input: {
    body: z.object({ foo: z.string() }),
    params: z.object({ id: z.string() }),
  },
  output: {
    200: UserSchema,
    400: OneCoreGenericErrorSchema,
    404: OneCoreGenericErrorSchema,
    500: OneCoreGenericErrorSchema,
  },
})

export const routes = (router: KoaRouter) => {
  router.get(
    '/users/:userId',
    routeHandler(route, async (ctx) => {
      // Enforces a return value that corresponds to one of
      // the provided output schemas.
      return {
        status: 200,
        data: { name: 'foo' },
      }
    })
  )
}
