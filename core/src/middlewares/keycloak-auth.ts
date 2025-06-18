import { Context, Next } from 'koa'
import auth from '../services/auth-service/keycloak'
import { logger } from 'onecore-utilities'

// Middleware to protect routes
export const requireAuth = async (ctx: Context, next: Next) => {
  try {
    await auth.middleware.extractJwtToken(ctx, next)
  } catch (error) {
    logger.error('Authentication error:', error)
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
      logger.error('Role verification error:', error)
      ctx.status = 401
      ctx.body = { message: 'Authentication required' }
    }
  }
}
