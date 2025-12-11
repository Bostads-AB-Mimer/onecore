import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/v2/Badge'
import { Lease } from '@/services/api/core/lease-service'
import type { RentalPropertyInfo } from '@onecore/types'

export const LeaseStatus = {
  Current: 0, // Gällande
  Upcoming: 1, // Kommande
  AboutToEnd: 2, // Uppsagt, kommer att upphöra
  Ended: 3, // Upphört
} as const

export const formatRentalType = (rentalType: string) => {
  // Remove " hyresobjektstyp" suffix if present ("Standard hyresobjektstyp" -> "Standard")
  return rentalType.replace(/ hyresobjektstyp$/i, '').trim()
}

export const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('sv-SE')
}

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    maximumFractionDigits: 0,
  }).format(amount)
}

export const formatAddress = (address: string) => {
  if (!address) return ''
  // Capitalize only the first letter, rest lowercase
  return address.charAt(0).toUpperCase() + address.slice(1).toLowerCase()
}

export const getPropertyIdentifier = (
  rentalProperty: RentalPropertyInfo | null
) => {
  if (!rentalProperty) return 'Data ej tillgänglig'

  const type = rentalProperty.type
  const property = rentalProperty.property

  if (type === 'Lägenhet' && 'number' in property) {
    return property.number || ''
  }
  if (type === 'Bilplats') {
    return property.code || ''
  }
  // Default fallback for other types
  return ('number' in property && property.number) || property.code || ''
}

export const getStatusBadge = (status: Lease['status']): ReactNode => {
  // Note: The generated TypeScript types say status is a string enum,
  // but the actual API returns numeric values (0, 1, 2, 3)
  const numericStatus = Number(status)

  switch (numericStatus) {
    case LeaseStatus.Current:
      return (
        <Badge
          variant="outline"
          className="bg-green-50 text-green-700 hover:bg-green-50 border-green-200"
        >
          Gällande
        </Badge>
      )
    case LeaseStatus.Upcoming:
      return (
        <Badge
          variant="outline"
          className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200"
        >
          Kommande
        </Badge>
      )
    case LeaseStatus.AboutToEnd:
      return (
        <Badge
          variant="outline"
          className="bg-yellow-50 text-yellow-700 hover:bg-yellow-50 border-yellow-200"
        >
          Upphör snart
        </Badge>
      )
    case LeaseStatus.Ended:
      return (
        <Badge
          variant="outline"
          className="bg-red-50 text-red-700 hover:bg-red-50 border-red-200"
        >
          Upphört
        </Badge>
      )
    default:
      return null
  }
}

export const sortLeasesByStatus = (
  leases: Lease[],
  rentalProperties: Record<string, RentalPropertyInfo | null>
): Lease[] => {
  // Sort leases with three tiers:
  // 1. Active/upcoming leases (with property data)
  // 2. Ended leases (with property data)
  // 3. Leases with missing property data
  return [...leases].sort((a, b) => {
    const aHasProperty = !!rentalProperties[a.rentalPropertyId]
    const bHasProperty = !!rentalProperties[b.rentalPropertyId]
    // API returns numeric values despite TypeScript types
    const aIsEnded = Number(a.status) === LeaseStatus.Ended
    const bIsEnded = Number(b.status) === LeaseStatus.Ended

    // If both have property data or both don't, sort by ended status
    if (aHasProperty === bHasProperty) {
      if (aIsEnded && !bIsEnded) return 1 // a is ended, b is not -> a goes after b
      if (!aIsEnded && bIsEnded) return -1 // a is not ended, b is -> a goes before b
      return 0 // Keep original order for items in same category
    }

    // Otherwise, prioritize those with property data
    if (aHasProperty && !bHasProperty) return -1
    if (!aHasProperty && bHasProperty) return 1
    return 0
  })
}
