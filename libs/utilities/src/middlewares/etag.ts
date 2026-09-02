import { Context, Next } from 'koa'
import crypto from 'crypto'

/**
 * Weak MD5 ETags + If-None-Match revalidation for plain-JSON responses.
 * Register AFTER compression middleware: the hash must cover the uncompressed
 * body, while compression still applies on the way out. Weak (W/) because the
 * same tag then rides both the identity and gzip encodings, which a strong
 * validator must not claim (RFC 9110 §8.8.1).
 */
export const etagMiddleware = () => {
  return async (ctx: Context, next: Next) => {
    await next()

    // Safe methods only: a mutation must never be short-circuited into a 304
    // after it has run, and its response is nothing a cache should hold.
    if (ctx.method !== 'GET' && ctx.method !== 'HEAD') {
      return
    }
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

    const content = JSON.stringify(body)
    const tag = `"${crypto.createHash('md5').update(content).digest('hex')}"`

    ctx.set('ETag', `W/${tag}`)

    // Bodies can be per-requester (capabilities): today the Authorization
    // header keeps shared caches away, but that guard dies at any edge that
    // terminates auth. Say it explicitly; routes may still override.
    if (!ctx.response.get('Cache-Control')) {
      ctx.set('Cache-Control', 'private')
    }

    // Compare on the bare tag: clients echo W/"..." back, but a proxy may
    // have stripped or added the prefix — either spelling is still ours.
    // '*' matches any current representation (RFC 9110 §13.1.2) — ours exists.
    const revalidators = ctx
      .get('If-None-Match')
      .split(',')
      .map((value) => value.trim().replace(/^W\//, ''))
    if (revalidators.includes('*') || revalidators.includes(tag)) {
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
