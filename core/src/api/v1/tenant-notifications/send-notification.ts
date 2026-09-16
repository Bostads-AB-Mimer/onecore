import { ParameterizedContext } from 'koa'
import {
  requiredRoleByNotificationType,
  TenantNotification,
  TenantNotificationEmail,
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

const sendByType = (notification: TenantNotificationEmail) => {
  switch (notification.type) {
    case TenantNotificationType.LeaseTerminationConfirmation:
      return communicationAdapter.sendLeaseTerminationConfirmationEmail(
        notification
      )
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
  notification: TenantNotificationEmail,
  idempotencyKey: string,
  store: IdempotencyStore = tenantNotificationIdempotencyStore
): Promise<SendTenantNotificationResult> => {
  if (!canSendNotificationType(ctx, notification.type)) {
    return { ok: false, error: 'insufficient-permissions' }
  }

  const payloadHash = hashNotificationPayload(notification)
  const claim = store.claim(idempotencyKey, payloadHash)

  if (claim === 'conflict') {
    return { ok: false, error: 'idempotency-conflict' }
  }

  if (claim === 'duplicate' || claim === 'in-flight') {
    return { ok: true, duplicate: true }
  }

  const result = await sendByType(notification)

  if (!result.ok) {
    store.release(idempotencyKey, payloadHash)
    return { ok: false, error: 'send-failed' }
  }

  store.markSucceeded(idempotencyKey, payloadHash)
  return { ok: true, duplicate: false }
}
