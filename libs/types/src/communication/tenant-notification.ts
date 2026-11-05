import { z } from 'zod'

/**
 * Tenant notifications that OneCore sends on behalf of an integration
 * (e.g. Tenfast) after a business event.
 *
 * Public API: `POST /v1/tenant-notifications/lease-termination-confirmation`
 * - Requires `Idempotency-Key` header for safe retries
 * - Callers supply structured facts only; OneCore owns templates and delivery
 */

/** Keycloak role for POST /v1/tenant-notifications/lease-termination-confirmation. */
export const TenantNotificationRole = {
  LeaseTermination: 'tenant-notifications:lease-termination',
} as const

/** `dispatch.messageType` written when a lease-termination confirmation is sent. */
export const LeaseTerminationConfirmationMessageType =
  'lease_termination_confirmation' as const

/** Supported rental categories for lease-termination confirmation. Extend when housing is added. */
export const LeaseTerminationRentalTypeSchema = z.enum(['Bilplats'])

export type LeaseTerminationRentalType = z.infer<
  typeof LeaseTerminationRentalTypeSchema
>

/** Public Core API request body — notification kind is implied by the URL. */
export const LeaseTerminationConfirmationRequestSchema = z.object({
  to: z.string().email(),
  contactCode: z.string().min(1),
  firstName: z.string().min(1),
  leaseId: z.string().min(1),
  endDate: z
    .string()
    .date()
    .transform((value) => new Date(`${value}T00:00:00.000Z`)),
  rentalType: LeaseTerminationRentalTypeSchema,
  correlationId: z.string().min(1).optional(),
})

export type LeaseTerminationConfirmationRequest = z.infer<
  typeof LeaseTerminationConfirmationRequestSchema
>

/** Communication service payload — adds server-set audit attribution. */
export const LeaseTerminationConfirmationEmailSchema =
  LeaseTerminationConfirmationRequestSchema.extend({
    triggeredByUser: z.string().min(1).optional(),
  })

export type LeaseTerminationConfirmationEmail = z.infer<
  typeof LeaseTerminationConfirmationEmailSchema
>
