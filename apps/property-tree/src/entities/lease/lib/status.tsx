import type { ReactNode } from 'react'

import { Lease } from '@/services/api/core/leaseService'

import { Badge } from '@/shared/ui/Badge'

export const LeaseStatus = {
  Current: 0, // Gällande
  Upcoming: 1, // Kommande
  AboutToEnd: 2, // Uppsagt, kommer att upphöra
  Ended: 3, // Upphört
  PreliminaryTerminated: 4, // Preliminärt uppsagt
  PendingSignature: 5, // Väntar på signering
  NotSent: 6, // Ej skickat
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
        className="bg-green-50 text-green-700 hover:bg-green-50 border-green-200 whitespace-nowrap"
      >
        Gällande
      </Badge>
    )
  }
  if (status === 'Upcoming' || numericStatus === LeaseStatus.Upcoming) {
    return (
      <Badge
        variant="outline"
        className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200 whitespace-nowrap"
      >
        Kommande
      </Badge>
    )
  }
  if (status === 'AboutToEnd' || numericStatus === LeaseStatus.AboutToEnd) {
    return (
      <Badge
        variant="outline"
        className="bg-yellow-50 text-yellow-700 hover:bg-yellow-50 border-yellow-200 whitespace-nowrap"
      >
        Upphör snart
      </Badge>
    )
  }
  if (status === 'Ended' || numericStatus === LeaseStatus.Ended) {
    return (
      <Badge
        variant="outline"
        className="bg-red-50 text-red-700 hover:bg-red-50 border-red-200 whitespace-nowrap"
      >
        Upphört
      </Badge>
    )
  }
  if (
    status === 'PreliminaryTerminated' ||
    numericStatus === LeaseStatus.PreliminaryTerminated
  ) {
    return (
      <Badge
        variant="outline"
        className="bg-orange-50 text-orange-700 hover:bg-orange-50 border-orange-200 whitespace-nowrap"
      >
        Prel. uppsagt
      </Badge>
    )
  }
  if (
    status === 'PendingSignature' ||
    numericStatus === LeaseStatus.PendingSignature
  ) {
    return (
      <Badge
        variant="outline"
        className="bg-purple-50 text-purple-700 hover:bg-purple-50 border-purple-200 whitespace-nowrap"
      >
        Signering
      </Badge>
    )
  }
  if (status === 'NotSent' || numericStatus === LeaseStatus.NotSent) {
    return (
      <Badge
        variant="outline"
        className="bg-gray-50 text-gray-700 hover:bg-gray-50 border-gray-200 whitespace-nowrap"
      >
        Ej skickat
      </Badge>
    )
  }

  return null
}
