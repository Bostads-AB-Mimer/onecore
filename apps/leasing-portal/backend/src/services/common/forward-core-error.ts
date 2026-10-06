import type { Context } from 'koa'
import { CoreResult } from '@src/adapters/core-adapter'

export type CoreFailure = Extract<CoreResult, { ok: false }>

/** Core 4xx (403, 404, 409...) pass through with core's body. Anything else is 502. Field names follow core's AdapterResult. */
export const forwardCoreError = (ctx: Context, result: CoreFailure) => {
  if (result.statusCode >= 400 && result.statusCode < 500) {
    ctx.status = result.statusCode
    // Koa turns a null body into 204; keep the error status if core sent no body.
    ctx.body = result.err ?? { error: 'core-error' }
    return
  }

  ctx.status = 502
  ctx.body = { error: 'core-unavailable' }
}
