import type { Context, Next } from 'koa'

const AUTH_COOKIE = 'auth_token'

const bearerToken = (header: string): string | undefined =>
  header.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined

/** Rejects requests without a core token. Core's cookie only reaches us under core's host. */
export const requireUserToken = async (ctx: Context, next: Next) => {
  const token =
    ctx.cookies.get(AUTH_COOKIE) ?? bearerToken(ctx.get('Authorization'))

  if (!token) {
    ctx.status = 401
    ctx.body = { error: 'unauthenticated' }
    return
  }

  ctx.state.accessToken = token
  await next()
}

/** Reads the token requireUserToken stored. Throws if the route is not behind it. */
export const getAccessToken = (ctx: Context): string => {
  const token: unknown = ctx.state.accessToken
  if (typeof token !== 'string') {
    throw new Error('getAccessToken called on a route without requireUserToken')
  }
  return token
}
