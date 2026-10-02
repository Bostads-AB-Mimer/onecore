import type { Context } from 'koa'
import { CoreResult } from '@src/adapters/core-adapter'

export type CoreFailure = Extract<CoreResult, { ok: false }>

/** Core 4xx (403, 404, 409...) pass through with core's body. Anything else is 502. */
export const forwardCoreError = (ctx: Context, result: CoreFailure) => {
  if (result.status >= 400 && result.status < 500) {
    ctx.status = result.status
    ctx.body = result.error
    return
  }

  ctx.status = 502
  ctx.body = { error: 'core-unavailable' }
}
