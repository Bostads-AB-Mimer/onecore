import type { Context } from 'koa'
import { CoreResult } from '@src/adapters/core-adapter'

export type CoreFailure = Extract<CoreResult, { ok: false }>

/** Core 4xx pass through; anything else becomes 502 (the BFF's own errors are
 * 500) with core's body kept, since it names which upstream broke. */
export const forwardCoreError = (ctx: Context, result: CoreFailure) => {
  const body =
    result.err && typeof result.err === 'object'
      ? result.err
      : { error: typeof result.err === 'string' ? result.err : 'core-error' }

  ctx.status =
    result.statusCode >= 400 && result.statusCode < 500
      ? result.statusCode
      : 502
  // Koa turns a null body into 204; keep the error status if core sent no body.
  ctx.body = body
}
