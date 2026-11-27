import type { PropertyKvvAreaLookup } from '@/services/api/core'

// The cost center of a KVV-area is its district (distrikt). Pages that already
// show the district elsewhere pass `withDistrict: false` to avoid repeating it.
export const formatKvvArea = (
  { kvvArea, costCenter }: PropertyKvvAreaLookup,
  { withDistrict }: { withDistrict: boolean }
): string => {
  const area = kvvArea.name ?? kvvArea.code
  return withDistrict ? `${area}, ${costCenter.name}` : area
}
