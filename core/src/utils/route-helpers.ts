import { logger, generateRouteMetadata } from '@onecore/utilities'
import { z } from 'zod'

type RouteMetadata = ReturnType<typeof generateRouteMetadata>

// The slice of the Koa context the helpers touch, so any route's ctx fits.
interface ReplyContext {
  status: number
  body: unknown
  path: string
  query: unknown
}

/** safeParse ctx.query; on failure answers the 400 and returns undefined. */
export const parseQuery = <T extends z.ZodTypeAny>(
  ctx: ReplyContext,
  schema: T,
  metadata: RouteMetadata
): z.infer<T> | undefined => {
  const parsed = schema.safeParse(ctx.query)
  if (!parsed.success) {
    ctx.status = 400
    ctx.body = {
      reason: 'Invalid query parameters',
      errors: parsed.error.errors.map(({ path, message }) => ({
        path,
        message,
      })),
      ...metadata,
    }
    return undefined
  }
  return parsed.data
}

/**
 * Map an adapter error onto the status + reason body the routes document.
 * The 404 wording is the route's to define — what "not found" refers to
 * differs per endpoint.
 */
export const replyError = (
  ctx: ReplyContext,
  err: 'not-found' | 'bad-request' | 'unknown',
  metadata: RouteMetadata,
  reasons?: { notFound?: string }
): void => {
  if (err === 'not-found') {
    ctx.status = 404
    ctx.body = { reason: reasons?.notFound ?? 'Not found', ...metadata }
  } else if (err === 'bad-request') {
    ctx.status = 400
    ctx.body = { reason: 'Invalid query parameters', ...metadata }
  } else {
    ctx.status = 500
    ctx.body = { reason: 'Internal server error', ...metadata }
  }
}

/**
 * Validate an upstream payload before serving it. On a mismatch: log and
 * answer the JSON 500 the routes document, rather than letting a ZodError
 * throw into Koa's text/plain default.
 */
export const parseUpstream = <T extends z.ZodTypeAny>(
  ctx: ReplyContext,
  schema: T,
  data: unknown,
  metadata: RouteMetadata
): z.infer<T> | undefined => {
  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    logger.error(
      { path: ctx.path, errors: parsed.error.errors },
      'upstream payload failed validation'
    )
    ctx.status = 500
    ctx.body = { reason: 'Internal server error', ...metadata }
    return undefined
  }
  return parsed.data
}
