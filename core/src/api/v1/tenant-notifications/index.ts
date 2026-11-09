import { OkapiRouter } from 'koa-okapi-router'
import {
  generateRouteMetadata,
  logger,
  makeSuccessResponseBody,
} from '@onecore/utilities'
import { Config } from '@/common/config'
import {
  LeaseTerminationNotification,
  sendLeaseTerminationConfirmation,
} from './send-notification'
import {
  SendLeaseTerminationConfirmationErrorResponseBodySchema_APIv1,
  SendLeaseTerminationConfirmationRequestBodySchema,
  SendLeaseTerminationConfirmationResponseBodySchema_APIv1,
} from './schema'

const IDEMPOTENCY_HEADER = 'idempotency-key'
const LEASE_TERMINATION_CONFIRMATION_PATH =
  '/v1/tenant-notifications/lease-termination-confirmation'

export const routes = (router: OkapiRouter, _config: Config) => {
  router.post(
    LEASE_TERMINATION_CONFIRMATION_PATH,
    {
      summary: 'Send a lease termination confirmation email',
      description:
        'Triggers a lease termination confirmation email on behalf of an ' +
        'integration (e.g. Tenfast) after a parking lease is terminated. ' +
        'Only `leaseId` is required: OneCore looks up the lease (end date, ' +
        'type, preferred move-out date, rental object address, holders) and ' +
        'each holder in the contacts service, then emails every holder with ' +
        'an email address. The other body fields are optional and kept for ' +
        'compatibility: `to` and `firstName` are ignored, `contactCode` adds ' +
        'a recipient, `endDate` and `rentalType` are fallbacks when the lease ' +
        'lacks them. ' +
        'Requires `Idempotency-Key` for safe retries. OneCore owns delivery ' +
        'and the communication log. Requires `tenant-notifications:lease-termination` ' +
        'or `api-access`.',
      tags: ['Tenant notifications'],
      body: {
        name: 'SendLeaseTerminationConfirmationRequest',
        schema: SendLeaseTerminationConfirmationRequestBodySchema,
      },
      response: {
        200: SendLeaseTerminationConfirmationResponseBodySchema_APIv1,
        400: SendLeaseTerminationConfirmationErrorResponseBodySchema_APIv1,
        404: SendLeaseTerminationConfirmationErrorResponseBodySchema_APIv1,
        409: SendLeaseTerminationConfirmationErrorResponseBodySchema_APIv1,
        422: SendLeaseTerminationConfirmationErrorResponseBodySchema_APIv1,
        502: SendLeaseTerminationConfirmationErrorResponseBodySchema_APIv1,
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

      const parsed =
        SendLeaseTerminationConfirmationRequestBodySchema.safeParse(
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

      const notification: LeaseTerminationNotification = {
        ...parsed.data,
        triggeredByUser:
          ctx.state.user?.name ?? ctx.state.user?.preferred_username,
      }

      const result = await sendLeaseTerminationConfirmation(
        notification,
        idempotencyKey
      )

      if (!result.ok) {
        switch (result.error) {
          case 'idempotency-conflict':
            ctx.status = 409
            ctx.body = {
              error: 'idempotency-conflict',
              detail:
                'Idempotency-Key was reused with a different notification payload',
              ...metadata,
            }
            return
          case 'lease-not-found':
            // Tenfast just confirmed this lease, so it is expected to exist.
            logger.error(
              { leaseId: notification.leaseId, idempotencyKey },
              'Lease termination confirmation: lease not found'
            )
            ctx.status = 404
            ctx.body = {
              error: 'lease-not-found',
              detail: `Lease ${notification.leaseId} was not found`,
              ...metadata,
            }
            return
          case 'missing-end-date':
            ctx.status = 422
            ctx.body = {
              error: 'missing-end-date',
              detail:
                'The lease has no end date and the request did not supply endDate',
              ...metadata,
            }
            return
          case 'unsupported-rental-type':
            ctx.status = 422
            ctx.body = {
              error: 'unsupported-rental-type',
              detail:
                'The lease is not a parking space contract and the request did not supply rentalType',
              ...metadata,
            }
            return
          case 'no-recipient':
            ctx.status = 422
            ctx.body = {
              error: 'no-recipient',
              detail: 'No lease holder has an email address in contacts',
              ...metadata,
            }
            return
          case 'lease-lookup-failed':
          case 'contact-lookup-failed':
            // Already logged with the underlying cause where it happened.
            ctx.status = 502
            ctx.body = { error: result.error, ...metadata }
            return
          case 'send-failed':
            logger.error(
              {
                error: result.error,
                leaseId: notification.leaseId,
                correlationId: notification.correlationId,
                idempotencyKey,
              },
              'Failed to send lease termination confirmation'
            )
            ctx.status = 502
            ctx.body = { error: result.error, ...metadata }
            return
          default: {
            const _exhaustive: never = result.error
            throw new Error(`Unhandled send error: ${_exhaustive}`)
          }
        }
      }

      ctx.status = 200
      ctx.body = makeSuccessResponseBody({ sent: true as const }, metadata)
    }
  )
}
