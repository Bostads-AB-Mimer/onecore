import { OkapiRouter } from 'koa-okapi-router'
import {
  generateRouteMetadata,
  logger,
  makeSuccessResponseBody,
} from '@onecore/utilities'
import { TenantNotificationEmail } from '@onecore/types'

import { Config } from '@/common/config'
import { sendTenantNotification } from './send-notification'
import {
  SendTenantNotificationErrorResponseBodySchema_APIv1,
  SendTenantNotificationRequestBodySchema,
  SendTenantNotificationResponseBodySchema_APIv1,
} from './schema'

const IDEMPOTENCY_HEADER = 'idempotency-key'

export const routes = (router: OkapiRouter, _config: Config) => {
  router.post(
    '/v1/tenant-notifications',
    {
      summary: 'Send a tenant notification',
      description:
        'Triggers a templated tenant notification on behalf of an integration ' +
        '(e.g. Tenfast) after a business event. Requires `Idempotency-Key` for ' +
        'safe retries. OneCore owns delivery and the communication log. Requires ' +
        'the type-specific Keycloak role or `api-access` — see ' +
        '`requiredRoleByNotificationType` in @onecore/types.',
      tags: ['Tenant notifications'],
      body: {
        name: 'SendTenantNotificationRequest',
        schema: SendTenantNotificationRequestBodySchema,
      },
      response: {
        200: SendTenantNotificationResponseBodySchema_APIv1,
        400: SendTenantNotificationErrorResponseBodySchema_APIv1,
        403: SendTenantNotificationErrorResponseBodySchema_APIv1,
        409: SendTenantNotificationErrorResponseBodySchema_APIv1,
        502: SendTenantNotificationErrorResponseBodySchema_APIv1,
      },
    },
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)

      const idempotencyKey = ctx.get(IDEMPOTENCY_HEADER)?.trim()
      if (!idempotencyKey) {
        ctx.status = 400
        ctx.body = {
          error: 'missing-idempotency-key',
          detail: `${IDEMPOTENCY_HEADER} header is required`,
          ...metadata,
        }
        return
      }

      const parsed = SendTenantNotificationRequestBodySchema.safeParse(
        ctx.request.body
      )

      if (!parsed.success) {
        ctx.status = 400
        ctx.body = {
          error: 'invalid-request',
          detail: parsed.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; '),
          ...metadata,
        }
        return
      }

      const notification: TenantNotificationEmail = {
        ...parsed.data,
        triggeredByUser:
          ctx.state.user?.name ?? ctx.state.user?.preferred_username,
      }

      const result = await sendTenantNotification(
        ctx,
        notification,
        idempotencyKey
      )

      if (!result.ok) {
        switch (result.error) {
          case 'insufficient-permissions':
            ctx.status = 403
            ctx.body = { error: 'insufficient-permissions', ...metadata }
            return
          case 'idempotency-conflict':
            ctx.status = 409
            ctx.body = {
              error: 'idempotency-conflict',
              detail:
                'Idempotency-Key was reused with a different notification payload',
              ...metadata,
            }
            return
          case 'send-failed':
            logger.error(
              {
                type: notification.type,
                to: notification.to,
                correlationId: notification.correlationId,
                idempotencyKey,
              },
              'Failed to send tenant notification'
            )
            ctx.status = 502
            ctx.body = { error: 'send-failed', ...metadata }
            return
        }
      }

      ctx.status = 200
      ctx.body = makeSuccessResponseBody({ sent: true as const }, metadata)
    }
  )
}
