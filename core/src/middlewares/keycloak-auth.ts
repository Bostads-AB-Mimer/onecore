import assert from 'node:assert'
import { Context, Next } from 'koa'
import jwt from 'jsonwebtoken'
import auth from '../services/auth-service/keycloak'
import config from '../common/config'
import { logger } from '@onecore/utilities'

/**
 * Middleware to protect routes. Must run after extractToken.
 * Verifies the token (Keycloak JWKS, with legacy JWT fallback) and sets ctx.state.user.
 */
export const requireAuth = async (ctx: Context, next: Next) => {
  const accessToken: string | undefined = ctx.state.accessToken

  if (!accessToken) {
    ctx.status = 401
    ctx.body = { message: 'Authentication required' }
    return
  }

  try {
    const verifiedToken = await auth.jwksService.verifyToken(accessToken)
    ctx.state.user = {
      id: verifiedToken.sub,
      email: verifiedToken.email,
      name: verifiedToken.name,
      preferred_username: verifiedToken.preferred_username,
      source: 'keycloak',
      realm_access: verifiedToken.realm_access,
    }
    return next()
  } catch {
    // Not a Keycloak token — try legacy JWT. TODO: Remove legacy JWT use in the codebase
  }

  try {
    const decoded = jwt.verify(accessToken, config.auth.secret) as {
      sub: string
      username: string
    }
    ctx.state.user = {
      id: decoded.sub,
      username: decoded.username,
      source: 'legacy-jwt',
      // REMOVE WHEN INTERNAL PORTAL USES KEYCLOAK
      realm_access: { roles: ['api-access'] },
      //TODO: Fix auth in internal portal to use keycloak! we cannot support roles in legacy tokens without a major refactor, so we just give them api-access for now
    }
    return next()
  } catch (error) {
    logger.error(error, 'Authentication error:')
    ctx.status = 401
    ctx.body = { message: 'Authentication required' }
  }
}

// Middleware to check for specific Keycloak realm roles.
// Must run after requireAuth.
export const requireRole = (requiredRoles: string | string[]) => {
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles]

  return async (ctx: Context, next: Next) => {
    assert(
      ctx.state.user,
      'requireRole middleware must run after requireAuth — ctx.state.user is not set'
    )

    try {
      const userRoles: string[] = ctx.state.user?.realm_access?.roles || []
      const hasRequiredRole = roles.some((role) => userRoles.includes(role))

      if (!hasRequiredRole) {
        ctx.status = 403
        ctx.body = { message: 'Insufficient permissions' }
        return
      }

      return next()
    } catch (error) {
      logger.error(error, 'Role verification error:')
      ctx.status = 403
      ctx.body = { message: 'Insufficient permissions' }
    }
  }
}
