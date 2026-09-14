import { ParameterizedContext } from 'koa'
import {
  requiredRoleByNotificationType,
  TenantNotification,
  TenantNotificationType,
} from '@onecore/types'

import * as communicationAdapter from '../../../adapters/communication-adapter'
import {
  hashNotificationPayload,
  IdempotencyStore,
  tenantNotificationIdempotencyStore,
} from './idempotency'

const API_ACCESS_ROLE = 'api-access'

/** Matches other integration routes: use-case role OR api-access. */
const canSendNotificationType = (
  ctx: ParameterizedContext,
  type: TenantNotification['type']
) => {
  const userRoles = ctx.state.user?.realm_access?.roles ?? []
  return (
    userRoles.includes(API_ACCESS_ROLE) ||
    userRoles.includes(requiredRoleByNotificationType[type])
  )
}

const sendByType = (notification: TenantNotification) => {
  switch (notification.type) {
    case TenantNotificationType.LeaseTerminationConfirmation:
      return communicationAdapter.sendLeaseTerminationConfirmationEmail(
        notification
      )
    default: {
      const _never: never = notification.type
      throw new Error(
        `Unhandled tenant notification type: ${JSON.stringify(_never)}`
      )
    }
  }
}

export type SendTenantNotificationResult =
  | { ok: true; duplicate: boolean }
  | {
      ok: false
      error: 'insufficient-permissions' | 'idempotency-conflict' | 'send-failed'
    }

export const sendTenantNotification = async (
  ctx: ParameterizedContext,
  notification: TenantNotification,
  idempotencyKey: string,
  store: IdempotencyStore = tenantNotificationIdempotencyStore
): Promise<SendTenantNotificationResult> => {
  if (!canSendNotificationType(ctx, notification.type)) {
    return { ok: false, error: 'insufficient-permissions' }
  }

  const payloadHash = hashNotificationPayload(notification)
  const idempotency = store.evaluate(idempotencyKey, payloadHash)

  if (idempotency === 'conflict') {
    return { ok: false, error: 'idempotency-conflict' }
  }

  if (idempotency === 'duplicate') {
    return { ok: true, duplicate: true }
  }

  const result = await sendByType(notification)

  if (!result.ok) {
    return { ok: false, error: 'send-failed' }
  }

  store.remember(idempotencyKey, payloadHash)
  return { ok: true, duplicate: false }
}
