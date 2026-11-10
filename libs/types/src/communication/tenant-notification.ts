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

const DateOnlySchema = z
  .string()
  .date()
  .transform((value) => new Date(`${value}T00:00:00.000Z`))

/**
 * Public Core API request body — notification kind is implied by the URL.
 *
 * Only `leaseId` is used: OneCore reads everything else from the lease and
 * the contacts service. Tenfast still sends `to`, `contactCode`, `firstName`,
 * `endDate` and `rentalType`; parsing strips them so they can never override
 * the lease data.
 */
export const LeaseTerminationConfirmationRequestSchema = z.object({
  leaseId: z.string().min(1),
  correlationId: z.string().min(1).optional(),
})

export type LeaseTerminationConfirmationRequest = z.infer<
  typeof LeaseTerminationConfirmationRequestSchema
>

/**
 * A lease holder as shown in the confirmation. Core resolves it from the
 * contacts service (never from the integration payload). Empty strings mean
 * contacts has no value — e.g. an organisation has no birth date.
 */
export const LeaseTerminationTenantSchema = z.object({
  contactCode: z.string().min(1),
  fullName: z.string(),
  birthDate: z.string(),
  street: z.string(),
  zipCode: z.string(),
  city: z.string(),
})

export type LeaseTerminationTenant = z.infer<
  typeof LeaseTerminationTenantSchema
>

/**
 * Communication service payload for one recipient. Core sends one per lease
 * holder: `to`, `contactCode`, `firstName` and `lastName` describe the
 * recipient, `tenants` lists every holder on the lease (recipient included).
 */
export const LeaseTerminationConfirmationEmailSchema = z.object({
  to: z.string().email(),
  contactCode: z.string().min(1),
  // May be empty: a holder without a name in contacts still gets the email.
  firstName: z.string(),
  lastName: z.string(),
  leaseId: z.string().min(1),
  endDate: DateOnlySchema,
  rentalType: LeaseTerminationRentalTypeSchema,
  correlationId: z.string().min(1).optional(),
  preferredMoveOutDate: z.string().date().optional(),
  rentalObjectAddress: z.string().optional(),
  tenants: z.array(LeaseTerminationTenantSchema).min(1),
  triggeredByUser: z.string().min(1).optional(),
})

export type LeaseTerminationConfirmationEmail = z.infer<
  typeof LeaseTerminationConfirmationEmailSchema
>
