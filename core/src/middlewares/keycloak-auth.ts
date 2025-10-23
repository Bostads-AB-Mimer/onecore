import { Context, Next } from 'koa'
import auth from '../services/auth-service/keycloak'
import { logger } from '@onecore/utilities'

// Middleware to protect routes with proactive token refresh
export const requireAuth = async (ctx: Context, next: Next) => {
  try {
    const accessToken = ctx.cookies.get('auth_token')
    const refreshToken = ctx.cookies.get('refresh_token')

    // If no access token, return 401
    if (!accessToken) {
      ctx.status = 401
      ctx.body = { message: 'Authentication required' }
      return
    }

    // Check if token is expiring soon (within 60 seconds)
    if (auth.isTokenExpiringSoon(accessToken, 60) && refreshToken) {
      try {
        // Refresh tokens (race-condition protected via mutex)
        const newTokens = await auth.refreshAccessToken(refreshToken)

        // Update both cookies in response headers (for next request)
        auth.tokenService.setCookies(ctx, newTokens)

        // CRITICAL FIX: Verify and decode the NEW token directly
        // Don't call extractJwtToken - it reads old token from request cookies
        const verifiedToken = await auth.jwksService.verifyToken(
          newTokens.access_token
        )

        // Set user on context manually (same as extractJwtToken does)
        ctx.state.user = {
          id: verifiedToken.sub,
          email: verifiedToken.email,
          name: verifiedToken.name,
          preferred_username: verifiedToken.preferred_username,
          source: 'keycloak',
          realm_access: verifiedToken.realm_access, // For role checking
        }

        // Continue to next middleware (skip extractJwtToken)
        return await next()
      } catch (refreshError) {
        logger.error(
          refreshError,
          'Token refresh failed, falling back to validation'
        )
        // If refresh fails, try to validate existing token below
      }
    }

    // If no refresh needed OR refresh failed, use standard token extraction
    await auth.middleware.extractJwtToken(ctx, next)
  } catch (error) {
    logger.error(error, 'Authentication error:')
    ctx.status = 401
    ctx.body = { message: 'Authentication required' }
  }
}

// Middleware to check for specific roles
// TODO: fetch roles from entraID
export const requireRole = (requiredRoles: string | string[]) => {
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles]

  return async (ctx: Context, next: Next) => {
    try {
      await auth.middleware.extractJwtToken(ctx, next)

      const userRoles = ctx.state.user?.realm_access?.roles || []
      const hasRequiredRole = roles.some((role) => userRoles.includes(role))

      if (!hasRequiredRole) {
        ctx.status = 403
        ctx.body = { message: 'Insufficient permissions' }
        return
      }

      return next()
    } catch (error) {
      logger.error(error, 'Role verification error:')
      ctx.status = 401
      ctx.body = { message: 'Authentication required' }
    }
  }
}
