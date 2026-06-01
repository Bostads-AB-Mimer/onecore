import { Lease as OnecoreTypesLease } from '@onecore/types'
import { z } from 'zod'

/**
 * This is a partial zod representation of the current Lease type from onecore-types
 * I believe the original type has issues with circular references and decided to leave those out
 * as I believe the original Lease type will need some refactoring.
 *
 * Lease.tenants has a list of contacts, which in turn has a list of leases
 * Lease.roomtype has a list of material choices, which also has circular references.
 */

/**
 * Contact schema for Swagger OpenAPI generation
 * Matches the response from GET /contacts/{contactCode}
 *
 * KEEP IN SYNC WITH the inline `tenants` array in `Lease` below. All tenants are
 * contacts (not the reverse): every field here MUST exist on a tenant. A tenant may
 * ADD fields or be STRICTER (narrower) on a shared one, but may never drop or loosen
 * one. The tenant shape is an inline copy on purpose — extending/referencing a shared
 * schema makes zod-to-json-schema emit a $ref for the shared `address`, which the
 * generated frontend types can't resolve. Enforced by tests/contact-tenant-sync.test.ts.
 */
export const Contact = z.object({
  contactCode: z.string(),
  contactKey: z.string(),
  leaseIds: z.array(z.string()).optional(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  fullName: z.string().nullable(),
  nationalRegistrationNumber: z.string(),
  birthDate: z.coerce.date().nullable(),
  address: z
    .object({
      street: z.string().optional(),
      number: z.string(),
      postalCode: z.string(),
      city: z.string(),
    })
    .nullable()
    .optional(),
  phoneNumbers: z
    .array(
      z.object({
        phoneNumber: z.string(),
        type: z.string(),
        isMainNumber: z.boolean(),
      })
    )
    .optional(),
  emailAddress: z.string().nullable().optional(),
  isTenant: z.boolean(),
  specialAttention: z.boolean().optional(),
})

export const Lease = z.object({
  leaseId: z.string(),
  leaseNumber: z.string(),
  leaseStartDate: z.coerce.date(),
  leaseEndDate: z.coerce.date().optional(),
  status: z.enum(['Current', 'Upcoming', 'AboutToEnd', 'Ended']),
  tenantContactIds: z.array(z.string()).optional(),
  rentalPropertyId: z.string(),
  rentalProperty: z
    .object({
      rentalPropertyId: z.string(),
      apartmentNumber: z.number(),
      size: z.number(),
      type: z.string(),
      address: z
        .object({
          street: z.string().optional(),
          number: z.string(),
          postalCode: z.string(),
          city: z.string(),
        })
        .optional(),
      rentalPropertyType: z.string(),
      additionsIncludedInRent: z.string(),
      otherInfo: z.string().optional(),
      roomTypes: z
        .array(
          z.object({
            roomTypeId: z.string(),
            name: z.string(),
          })
        )
        .optional(),
      lastUpdated: z.coerce.date().optional(),
    })
    .optional(),
  type: z.string(),
  rentInfo: z
    .object({
      currentRent: z.object({
        rentId: z.string().optional(),
        leaseId: z.string().optional(),
        currentRent: z.number(),
        vat: z.number(),
        additionalChargeDescription: z.string().optional(),
        additionalChargeAmount: z.number().optional(),
        rentStartDate: z.coerce.date().optional(),
        rentEndDate: z.coerce.date().optional(),
      }),
    })
    .optional(),
  address: z
    .object({
      street: z.string().optional(),
      number: z.string(),
      postalCode: z.string(),
      city: z.string(),
    })
    .optional(),
  noticeGivenBy: z.string().optional(),
  noticeDate: z.coerce.date().optional(),
  noticeTimeTenant: z.union([z.string(), z.number()]).optional(),
  preferredMoveOutDate: z.coerce.date().optional(),
  terminationDate: z.coerce.date().optional(),
  contractDate: z.coerce.date().optional(),
  lastDebitDate: z.coerce.date().optional(),
  approvalDate: z.coerce.date().optional(),
  residentialArea: z
    .object({
      code: z.string(),
      caption: z.string(),
    })
    .optional(),
  // KEEP IN SYNC WITH `Contact` above — all tenants are contacts. A tenant must
  // carry every Contact field (here it adds parkingSpaceWaitingList and
  // leaseContactType); it may be stricter on a shared field but never drop or
  // loosen one. Inline (not a ref) so no $ref leaks into the frontend types.
  // Enforced by tests/contact-tenant-sync.test.ts.
  tenants: z
    .array(
      z.object({
        contactCode: z.string(),
        contactKey: z.string(),
        leaseIds: z.array(z.string()).optional(),
        firstName: z.string().nullable(),
        lastName: z.string().nullable(),
        fullName: z.string().nullable(),
        nationalRegistrationNumber: z.string(),
        birthDate: z.coerce.date().nullable(),
        address: z
          .object({
            street: z.string().optional(),
            number: z.string(),
            postalCode: z.string(),
            city: z.string(),
          })
          .nullable()
          .optional(),
        phoneNumbers: z
          .array(
            z.object({
              phoneNumber: z.string(),
              type: z.string(),
              isMainNumber: z.boolean(),
            })
          )
          .optional(),
        emailAddress: z.string().nullable().optional(),
        isTenant: z.boolean(),
        specialAttention: z.boolean().optional(),
        // --- tenant-only additions (not part of Contact) ---
        parkingSpaceWaitingList: z
          .object({
            queueTime: z.coerce.date(),
            queuePoints: z.number(),
            type: z.number(),
          })
          .optional(),
        leaseContactType: z.string().optional(),
      })
    )
    .optional(),
})

export const GetLeasesByRentalPropertyIdQueryParams = z.object({
  includeUpcomingLeases: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  includeTerminatedLeases: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  includeContacts: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  includeRentInfo: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value !== 'false'), // defaults to true
})

export function mapLease(lease: OnecoreTypesLease): z.infer<typeof Lease> {
  return {
    leaseId: lease.leaseId,
    leaseNumber: lease.leaseNumber,
    leaseStartDate: lease.leaseStartDate,
    leaseEndDate: lease.leaseEndDate,
    status:
      lease.status === 0
        ? 'Current'
        : lease.status === 1
          ? 'Upcoming'
          : lease.status === 2
            ? 'AboutToEnd'
            : 'Ended',
    tenantContactIds: lease.tenantContactIds,
    rentalPropertyId: lease.rentalPropertyId,
    rentalProperty: lease.rentalProperty,
    type: lease.type,
    rentInfo: lease.rentInfo,
    address: lease.address,
    noticeGivenBy: lease.noticeGivenBy,
    noticeDate: lease.noticeDate,
    noticeTimeTenant: lease.noticeTimeTenant,
    preferredMoveOutDate: lease.preferredMoveOutDate,
    terminationDate: lease.terminationDate,
    contractDate: lease.contractDate,
    lastDebitDate: lease.lastDebitDate,
    approvalDate: lease.approvalDate,
    residentialArea: lease.residentialArea,
    tenants: lease.tenants,
  }
}
