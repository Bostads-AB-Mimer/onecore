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

const Address = z.object({
  street: z.string().optional(),
  number: z.string(),
  postalCode: z.string(),
  city: z.string(),
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
      address: Address.optional(),
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
  address: Address.optional(),
  noticeGivenBy: z.string().optional(),
  noticeDate: z.coerce.date().optional(),
  noticeTimeTenant: z.string().optional(),
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
  tenants: z
    .array(
      z.object({
        contactCode: z.string(),
        contactKey: z.string(),
        leaseIds: z.array(z.string()).optional(),
        firstName: z.string(),
        lastName: z.string(),
        fullName: z.string(),
        nationalRegistrationNumber: z.string(),
        birthDate: z.coerce.date(),
        address: Address.optional(),
        phoneNumbers: z
          .array(
            z.object({
              phoneNumber: z.string(),
              type: z.string(),
              isMainNumber: z.boolean(),
            })
          )
          .optional(),
        emailAddress: z.string().optional(),
        isTenant: z.boolean(),
        parkingSpaceWaitingList: z
          .object({
            queueTime: z.coerce.date(),
            queuePoints: z.number(),
            type: z.number(),
          })
          .optional(),
        specialAttention: z.boolean().optional(),
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
