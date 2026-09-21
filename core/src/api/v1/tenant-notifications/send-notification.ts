import {
  LeaseTerminationConfirmationEmail,
} from '@onecore/types'

import * as communicationAdapter from '../../../adapters/communication-adapter'
import {
  hashNotificationPayload,
  IdempotencyStore,
  tenantNotificationIdempotencyStore,
} from './idempotency'

export type SendLeaseTerminationConfirmationResult =
  | { ok: true; duplicate: boolean }
  | {
      ok: false
      error: 'idempotency-conflict' | 'send-failed'
    }

export const sendLeaseTerminationConfirmation = async (
  notification: LeaseTerminationConfirmationEmail,
  idempotencyKey: string,
  store: IdempotencyStore = tenantNotificationIdempotencyStore
): Promise<SendLeaseTerminationConfirmationResult> => {
  const payloadHash = hashNotificationPayload(notification)
  const claim = store.claim(idempotencyKey, payloadHash)

  if (claim === 'conflict') {
    return { ok: false, error: 'idempotency-conflict' }
  }

  if (claim === 'duplicate' || claim === 'in-flight') {
    return { ok: true, duplicate: true }
  }

  const result =
    await communicationAdapter.sendLeaseTerminationConfirmationEmail(
      notification
    )

  if (!result.ok) {
    store.release(idempotencyKey, payloadHash)
    return { ok: false, error: 'send-failed' }
  }

  store.markSucceeded(idempotencyKey, payloadHash)
  return { ok: true, duplicate: false }
}
