import { Context, Next } from 'koa'
import crypto from 'crypto'

export const etagMiddleware = () => {
  return async (ctx: Context, next: Next) => {
    await next()

    if (!ctx.body || ctx.status !== 200) {
      return
    }

    // Plain JSON only — buffers and streams must pass through untouched.
    const body: unknown = ctx.body
    if (
      typeof body !== 'object' ||
      Buffer.isBuffer(body) ||
      typeof (body as { pipe?: unknown }).pipe === 'function'
    ) {
      return
    }

    // Generate ETag from response body
    const content = JSON.stringify(body)
    const etag = crypto.createHash('md5').update(content).digest('hex')

    // Set ETag header
    ctx.set('ETag', `"${etag}"`)

    // Check If-None-Match
    const ifNoneMatch = ctx.get('If-None-Match')
    if (ifNoneMatch && ifNoneMatch === `"${etag}"`) {
      ctx.status = 304
      ctx.body = null
      return
    }

    // Hand Koa the string we just produced; otherwise it serializes the same
    // object a second time — twice the work on the largest payloads we serve.
    //
    // This stays application/json because assigning the object above already
    // set the type, and Koa only infers text/plain for a string when none is
    // set. Anything upstream that resets ctx.body to null before this would
    // silently turn the response into text/plain.
    ctx.body = content
  }
}
