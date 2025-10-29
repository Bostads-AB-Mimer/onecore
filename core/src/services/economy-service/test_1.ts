import KoaRouter from '@koa/router'
import {
  generateRouteMetadata,
  makeSuccessResponseBody,
} from '@onecore/utilities'

import z from 'zod'

import { DefaultContext, DefaultState, ParameterizedContext } from 'koa'
import { getUserData } from './get-user-data'

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

type RouteHandlerContext = ParameterizedContext<
  DefaultState,
  DefaultContext & KoaRouter.RouterParamContext<DefaultState, DefaultContext>,
  unknown
>

type ContextWithParsedInput<I extends RouteSpecInput | undefined> =
  I extends RouteSpecInput
    ? RouteHandlerContext & {
        parsed_input: {
          [K in keyof I]: I[K] extends z.ZodTypeAny ? z.infer<I[K]> : never
        }
      }
    : RouteHandlerContext & { parsed_input: unknown }

type ParseInputResult<I extends RouteSpecInput> =
  | {
      ok: true
      data: {
        [K in keyof I]: I[K] extends z.ZodTypeAny ? z.infer<I[K]> : never
      }
    }
  | { ok: false; error: string }

function parseInput<I extends RouteSpecInput>(
  schemas: I,
  input: { [K in keyof I]?: unknown }
): ParseInputResult<I> {
  const parsed: any = {}

  for (const [key, schema] of Object.entries(schemas)) {
    const result = schema.safeParse(input[key as keyof I])

    if (!result.success) {
      return { ok: false, error: result.error.message }
    }

    parsed[key] = result.data
  }

  return { ok: true, data: parsed }
}

export function routeHandler<
  I extends RouteSpecInput | undefined,
  O extends RouteSpecOutput,
  S extends keyof O & number,
>(
  spec: { input?: I; output: O },
  handler: (ctx: ContextWithParsedInput<I>) => Promise<ExpectedReturnType<O>[S]>
) {
  return async (ctx: RouteHandlerContext) => {
    const metadata = generateRouteMetadata(ctx)

    if (spec.input) {
      const parsedInput = parseInput(spec.input, {
        body: ctx.request.body,
        query: ctx.request.query,
        params: ctx.params,
      })

      if (!parsedInput.ok) {
        ctx.status = 400
        ctx.body = { error: parsedInput.error }
        return
      }

      ctx.parsed_input = parsedInput.data
    }

    const result = await handler(ctx as ContextWithParsedInput<I>)

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
const OneCoreBadParametersErrorSchema = z.object({ error: z.string() })

const route = createRouteSpec({
  name: 'get-user',
  description: 'Get a user by ID',
  method: 'get',
  path: '/users/:userId',
  input: {
    body: z.object({ foo: z.string() }),
    params: z.object({ userId: z.string() }),
  },
  output: {
    200: UserSchema,
    400: OneCoreBadParametersErrorSchema,
    404: OneCoreGenericErrorSchema,
    500: OneCoreGenericErrorSchema,
  },
})

export const routes = (router: KoaRouter) => {
  router.get(
    '/users/:userId',
    routeHandler(route, async (ctx) => {
      // 1. Parses the input and attaches it to ctx.parsed_input.
      // 2. Enforces a return value that corresponds to one of
      //    the provided output schemas.
      return {
        status: 200,
        data: getUserData(),
      }
    })
  )
}
