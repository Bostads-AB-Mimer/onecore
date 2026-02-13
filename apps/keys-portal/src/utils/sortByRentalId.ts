export function sortByRentalId<T extends { rentalId: string }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => a.rentalId.localeCompare(b.rentalId, 'sv'))
}
