import { Context, Next } from 'koa'
import config from '../common/config'
import { logger } from '@onecore/utilities'

export const requireAllowedIp = async (ctx: Context, next: Next) => {
  const allowedIps = config.scanner.allowedIps

  if (allowedIps.length === 0) {
    logger.warn(
      { clientIp: ctx.request.ip },
      'Scanner IP allowlist is empty — all IPs are blocked'
    )
    ctx.status = 403
    ctx.body = { message: 'Forbidden' }
    return
  }

  const clientIp = ctx.request.ip

  if (!allowedIps.includes(clientIp)) {
    logger.warn({ clientIp }, 'Scan request from non-allowed IP')
    ctx.status = 403
    ctx.body = { message: 'Forbidden' }
    return
  }

  return next()
}
