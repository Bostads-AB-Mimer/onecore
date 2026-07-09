import KoaRouter from '@koa/router'
import { logger } from '@onecore/utilities'
import crypto from 'node:crypto'

import config from '../../common/config'
import * as communicationAdapter from '../../adapters/communication-adapter'

// Constant-time string compare that never short-circuits on length.
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

/**
 * Public (pre-Keycloak) webhook for Infobip SMS delivery reports routed via
 * Tele2. Tele2's per-message webhook has no header slot, so it authenticates
 * with a secret `?token=` in the URL — unlike the email webhook, which uses a
 * Keycloak service account. Registered on the public router so it bypasses the
 * Keycloak auth chain; it does its own token check, then forwards to the
 * communication service for the same processing as the email path.
 *
 * Email's webhook (/webhooks/infobip) lives on the authenticated router and is
 * Keycloak-gated — these are deliberately distinct paths to avoid collision on
 * the shared api host.
 */
export const routes = (router: KoaRouter) => {
  // No generateRouteMetadata here: it reflects ctx.href — including the secret
  // ?token= — into every response body, needlessly spreading the token into
  // anything that captures bodies (APM, Infobip's delivery logs).
  router.post('/webhooks/infobip-sms', async (ctx) => {
    const { webhookToken } = config.infobip

    // Fail closed: reject any request without a token, then compare it against
    // our configured token. Safe even when our token is unconfigured — the
    // empty-vs-empty case is caught by `!provided`, and a non-empty provided
    // token can't equal an empty webhookToken (safeEqual length mismatch), so
    // every request is rejected. A forgotten env var locks the endpoint rather
    // than opening it, with no dependency on NODE_ENV. No legitimate traffic is
    // lost: a send only attaches the webhook when a token is set (see
    // buildDeliveryWebhook), so without one no real reports arrive here.
    const provided = Array.isArray(ctx.query.token)
      ? ctx.query.token[0]
      : ctx.query.token

    if (!provided || !safeEqual(provided, webhookToken)) {
      logger.warn(
        { providedToken: provided ? 'provided' : 'missing' },
        'webhooks.infobip-sms: invalid token'
      )
      ctx.status = 401
      ctx.body = { reason: 'Unauthorized' }
      return
    }

    const result = await communicationAdapter.forwardDeliveryReport(
      ctx.request.body
    )

    if (result.ok) {
      ctx.status = 200
      ctx.body = {}
    } else {
      ctx.status = result.statusCode ?? 500
      ctx.body = { error: result.err }
    }
  })
}
