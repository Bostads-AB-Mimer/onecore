import assert from 'node:assert'
import { Context, Next } from 'koa'
import jwt from 'jsonwebtoken'
import { errors as joseErrors } from 'jose'
import auth from '../services/auth-service/keycloak'
import config from '../common/config'
import { logger } from '@onecore/utilities'

/**
 * Try Keycloak JWKS verification.
 * Sets ctx.state.user on success, rejects expired/invalid Keycloak tokens,
 * and passes through to next middleware if the token isn't a Keycloak token.
 */
async function verifyKeycloakToken(ctx: Context, next: Next) {
  if (ctx.state.user) return next()
  assert(
    ctx.state.accessToken,
    'verifyKeycloakToken requires ctx.state.accessToken'
  )

  try {
    const verifiedToken = await auth.jwksService.verifyToken(
      ctx.state.accessToken
    )
    ctx.state.user = {
      id: verifiedToken.sub,
      email: verifiedToken.email,
      name: verifiedToken.name,
      preferred_username: verifiedToken.preferred_username,
      source: 'keycloak',
      realm_access: verifiedToken.realm_access,
    }
  } catch (error) {
    if (error instanceof joseErrors.JWTExpired) {
      ctx.status = 401
      ctx.body = { message: 'Token expired' }
      return
    }

    if (error instanceof joseErrors.JWTClaimValidationFailed) {
      logger.error(error, 'Keycloak token claim validation failed')
      ctx.status = 401
      ctx.body = { message: 'Invalid token' }
      return
    }

    if (
      error instanceof joseErrors.JWKSNoMatchingKey ||
      error instanceof joseErrors.JWSSignatureVerificationFailed
    ) {
      // Not a Keycloak token, fall through to legacy JWT without logging an error
    } else {
      logger.warn(
        error,
        'Keycloak verification failed, service may be down, falling through to legacy JWT'
      )
    }
  }

  return next()
}

/**
 * Legacy JWT verification (tokens from /auth/generatetoken).
 * Passes through if ctx.state.user is already set.
 * TODO: Remove when internal portal uses Keycloak.
 */
async function verifyLegacyJwt(ctx: Context, next: Next) {
  if (ctx.state.user) return next()
  assert(
    ctx.state.accessToken,
    'verifyLegacyJwt requires ctx.state.accessToken'
  )

  try {
    const decoded = jwt.verify(ctx.state.accessToken, config.auth.secret) as {
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

/**
 * Middleware to protect routes. Must run after extractToken.
 * Tries Keycloak JWKS first, falls back to legacy JWT.
 */
export const requireAuth = async (ctx: Context, next: Next) => {
  if (!ctx.state.accessToken) {
    ctx.status = 401
    ctx.body = { message: 'Authentication required' }
    return
  }

  await verifyKeycloakToken(ctx, async () => {
    await verifyLegacyJwt(ctx, next)
  })
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
