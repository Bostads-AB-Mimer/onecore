/**
 * Extracts the rental property ID from a lease ID.
 *
 * @param leaseId - A string representing the lease ID in the format "rentalPropertyId/..."
 * @returns The rental property ID extracted from the lease ID
 *
 */
export function getRentalPropertyIdFromLeaseId(leaseId: string): string {
  const parsedLeaseId = leaseId.split('/')
  const rentalPropertyId = parsedLeaseId[0]
  return rentalPropertyId
}
