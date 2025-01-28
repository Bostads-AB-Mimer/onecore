import { Context, Next } from 'koa'
import crypto from 'crypto'

export const etagMiddleware = () => {
  return async (ctx: Context, next: Next) => {
    await next()

    if (!ctx.body || ctx.status !== 200) {
      return
    }

    // Generate ETag from response body
    const content = JSON.stringify(ctx.body)
    const etag = crypto
      .createHash('md5')
      .update(content)
      .digest('hex')

    // Set ETag header
    ctx.set('ETag', `"${etag}"`)

    // Check If-None-Match
    const ifNoneMatch = ctx.get('If-None-Match')
    if (ifNoneMatch && ifNoneMatch === `"${etag}"`) {
      ctx.status = 304
      ctx.body = null
    }
  }
}
