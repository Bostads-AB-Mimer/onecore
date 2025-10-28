import KoaRouter from '@koa/router'
import {
  generateRouteMetadata,
  makeSuccessResponseBody,
} from '@onecore/utilities'
import { economy } from '@onecore/types'

import * as economyAdapter from '../../adapters/economy-adapter'
import z from 'zod'
import { Context } from 'koa'

export type RouteSpecInput = {
  body?: z.ZodTypeAny
  params?: z.ZodTypeAny
  query?: z.ZodTypeAny
}

type RouteSpec = {
  input?: RouteSpecInput
  output: RouteSpecOutput
}

export type RouteSpecOutput = { [key: number]: z.ZodTypeAny }

export function createRouteSpec<
  I extends RouteSpecInput = RouteSpecInput,
  O extends RouteSpecOutput = RouteSpecOutput,
>(spec: { input?: I; output: O }) {
  return spec
}

type ExpectedReturnType<O extends RouteSpecOutput> = {
  [K in keyof O & number]: { status: K; data: z.infer<O[K]> }
}

type HandlerResult<O extends RouteSpecOutput> = ExpectedReturnType<O>[keyof O &
  number]

function routeWrapper<S extends RouteSpec>(
  spec: S,
  handler: (ctx: Context) => Promise<HandlerResult<S['output']>>
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

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Economy service
 *     description: Operations related to economy
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 * security:
 *   - bearerAuth: []
 */

const ok = createRouteSpec({
  input: {
    body: z.object({ foo: z.string() }),
    params: z.object({ id: z.string() }),
  },
  output: {
    200: z.object({ bar: z.string() }),
    400: z.object({ error: z.string() }),
  },
})

export const routes = (router: KoaRouter) => {
  router.get(
    '/invoices/example/:invoiceId',
    routeWrapper(ok, async (ctx) => {
      return {
        status: 200 as const,
        data: {
          bar: 'foo',
        },
      }
    })
  )
  router.get('/invoices/:invoiceId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await economyAdapter.getInvoiceByInvoiceId(
      ctx.params.invoiceId
    )

    if (!result.ok) {
      ctx.status = result.err === 'not-found' ? 404 : 500
      return
    } else {
      ctx.status = 200
      ctx.body = makeSuccessResponseBody(result.data, metadata)
    }
  })

  router.get('/invoices/by-contact-code/:contactCode', async (ctx) => {
    const queryParams = economy.GetInvoicesByContactCodeQueryParams.safeParse(
      ctx.query
    )

    if (!queryParams.success) {
      ctx.status = 400
      return
    }

    const metadata = generateRouteMetadata(ctx)
    const result = await economyAdapter.getInvoicesByContactCode(
      ctx.params.contactCode,
      queryParams.data
    )

    if (!result.ok) {
      ctx.status = result.err === 'not-found' ? 404 : 500
      ctx.body = {
        error: result.err === 'not-found' ? 'Not found' : 'Unknown error',
      }
      return
    } else {
      ctx.status = 200
      ctx.body = makeSuccessResponseBody(
        { data: result.data, totalCount: result.data.length },
        metadata
      )
    }
  })
}
