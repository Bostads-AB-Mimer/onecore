import { ParameterizedContext } from 'koa'
import {
  LeaseTerminationConfirmationEmail,
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

const sendByType = (notification: LeaseTerminationConfirmationEmail) => {
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

type InFlightSendOutcome = { ok: true } | { ok: false; error: 'send-failed' }

/** Coalesces concurrent requests sharing an Idempotency-Key onto one send. */
const inFlightOperations = new Map<string, Promise<InFlightSendOutcome>>()

const waitForInFlightOperation = async (
  idempotencyKey: string
): Promise<Promise<InFlightSendOutcome>> => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const operation = inFlightOperations.get(idempotencyKey)
    if (operation) return operation
    await new Promise<void>((resolve) => {
      setImmediate(resolve)
    })
  }

  throw new Error(
    `In-flight idempotency reservation missing send operation for key: ${idempotencyKey}`
  )
}

const startInFlightSend = (
  notification: LeaseTerminationConfirmationEmail,
  idempotencyKey: string,
  payloadHash: string,
  store: IdempotencyStore
): Promise<InFlightSendOutcome> => {
  let settleOperation!: (outcome: InFlightSendOutcome) => void
  const operation = new Promise<InFlightSendOutcome>((resolve) => {
    settleOperation = resolve
  })

  inFlightOperations.set(idempotencyKey, operation)

  void (async () => {
    try {
      const result = await sendByType(notification)

      if (!result.ok) {
        store.release(idempotencyKey, payloadHash)
        settleOperation({ ok: false, error: 'send-failed' })
        return
      }

      store.markSucceeded(idempotencyKey, payloadHash)
      settleOperation({ ok: true })
    } finally {
      if (inFlightOperations.get(idempotencyKey) === operation) {
        inFlightOperations.delete(idempotencyKey)
      }
    }
  })()

  return operation
}

export const clearInFlightOperations = () => {
  inFlightOperations.clear()
}

export type SendTenantNotificationResult =
  | { ok: true; duplicate: boolean }
  | {
      ok: false
      error: 'insufficient-permissions' | 'idempotency-conflict' | 'send-failed'
    }

export const sendTenantNotification = async (
  ctx: ParameterizedContext,
  notification: LeaseTerminationConfirmationEmail,
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

  if (claim === 'duplicate') {
    return { ok: true, duplicate: true }
  }

  const operation =
    claim === 'claimed'
      ? startInFlightSend(notification, idempotencyKey, payloadHash, store)
      : await waitForInFlightOperation(idempotencyKey)

  const outcome = await operation

  if (outcome.ok) {
    return { ok: true, duplicate: claim !== 'claimed' }
  }

  return outcome
}
