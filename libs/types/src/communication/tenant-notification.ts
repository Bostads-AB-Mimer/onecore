import { z } from 'zod'

/**
 * Tenant notifications that OneCore sends on behalf of an integration
 * (e.g. Tenfast) after a business event.
 *
 * Public API: `POST /v1/tenant-notifications`
 * - Discriminated on `type` — one URL, per-type Keycloak roles (or `api-access`)
 * - Requires `Idempotency-Key` header for safe retries
 * - Callers supply structured facts only; OneCore owns templates and delivery
 */

export const TenantNotificationType = {
  LeaseTerminationConfirmation: 'lease-termination-confirmation',
} as const

export type TenantNotificationType =
  (typeof TenantNotificationType)[keyof typeof TenantNotificationType]

/** Keycloak role required to send each notification type via POST /v1/tenant-notifications. */
export const TenantNotificationRole = {
  LeaseTermination: 'tenant-notifications:lease-termination:send',
} as const

export const requiredRoleByNotificationType: Record<
  TenantNotificationType,
  string
> = {
  [TenantNotificationType.LeaseTerminationConfirmation]:
    TenantNotificationRole.LeaseTermination,
}

/** `dispatch.messageType` written when a lease-termination confirmation is sent. */
export const LeaseTerminationConfirmationMessageType =
  'lease_termination_confirmation' as const

/** Supported rental categories for lease-termination confirmation. Extend when housing is added. */
export const LeaseTerminationRentalTypeSchema = z.enum(['Bilplats'])

export type LeaseTerminationRentalType = z.infer<
  typeof LeaseTerminationRentalTypeSchema
>

export const LeaseTerminationConfirmationNotificationSchema = z.object({
  type: z.literal(TenantNotificationType.LeaseTerminationConfirmation),
  to: z.string().email(),
  contactCode: z.string().min(1),
  firstName: z.string().min(1),
  address: z.string().min(1),
  leaseId: z.string().min(1),
  endDate: z
    .string()
    .date()
    .transform((value) => new Date(`${value}T00:00:00.000Z`)),
  objectId: z.string().min(1),
  rentalType: LeaseTerminationRentalTypeSchema,
  parkingSpaceId: z.string().min(1).optional(),
  correlationId: z.string().min(1).optional(),
})

export const TenantNotificationSchema = z.discriminatedUnion('type', [
  LeaseTerminationConfirmationNotificationSchema,
])

export type LeaseTerminationConfirmationNotification = z.infer<
  typeof LeaseTerminationConfirmationNotificationSchema
>
export type TenantNotification = z.infer<typeof TenantNotificationSchema>

/** Internal communication payload — adds server-set audit attribution. */
export const LeaseTerminationConfirmationEmailSchema =
  LeaseTerminationConfirmationNotificationSchema.extend({
    triggeredByUser: z.string().min(1).optional(),
  })

export type LeaseTerminationConfirmationEmail = z.infer<
  typeof LeaseTerminationConfirmationEmailSchema
>

export const TenantNotificationEmailSchema = z.discriminatedUnion('type', [
  LeaseTerminationConfirmationEmailSchema,
])

export type TenantNotificationEmail = z.infer<
  typeof TenantNotificationEmailSchema
>
