import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/v2/Badge'
import { Lease } from '@/services/api/core/lease-service'

export const LeaseStatus = {
  Current: 0, // Gällande
  Upcoming: 1, // Kommande
  AboutToEnd: 2, // Uppsagt, kommer att upphöra
  Ended: 3, // Upphört
} as const

export const getStatusBadge = (status: Lease['status'] | number): ReactNode => {
  // Note: The API can return either numeric values (0, 1, 2, 3) or string enum values
  // ("Current", "Upcoming", "AboutToEnd", "Ended") depending on the endpoint
  const numericStatus = Number(status)

  // Handle string enum values first
  if (status === 'Current' || numericStatus === LeaseStatus.Current) {
    return (
      <Badge
        variant="outline"
        className="bg-green-50 text-green-700 hover:bg-green-50 border-green-200"
      >
        Gällande
      </Badge>
    )
  }
  if (status === 'Upcoming' || numericStatus === LeaseStatus.Upcoming) {
    return (
      <Badge
        variant="outline"
        className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200"
      >
        Kommande
      </Badge>
    )
  }
  if (status === 'AboutToEnd' || numericStatus === LeaseStatus.AboutToEnd) {
    return (
      <Badge
        variant="outline"
        className="bg-yellow-50 text-yellow-700 hover:bg-yellow-50 border-yellow-200"
      >
        Upphör snart
      </Badge>
    )
  }
  if (status === 'Ended' || numericStatus === LeaseStatus.Ended) {
    return (
      <Badge
        variant="outline"
        className="bg-red-50 text-red-700 hover:bg-red-50 border-red-200"
      >
        Upphört
      </Badge>
    )
  }

  return null
}
