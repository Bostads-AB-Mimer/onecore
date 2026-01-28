import { Badge } from '@/components/ui/v2/Badge'
import { LeaseStatus } from '@onecore/types'

/**
 * Reusable badges for consistent styling across the application
 */

// Lease Status Badges
export const LeaseStatusBadge = ({ status }: { status: LeaseStatus }) => {
  switch (status) {
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
      return <span className="text-muted-foreground">-</span>
  }
}

// Object Type Badges
export const ObjectTypeBadge = ({ type }: { type: string | null }) => {
  const normalizedType = type?.toLowerCase()

  const badgeClass = 'bg-white text-gray-900 hover:bg-white border-gray-300'

  switch (normalizedType) {
    case 'bostad':
    case 'lägenhet':
      return (
        <Badge variant="outline" className={badgeClass}>
          Bostad
        </Badge>
      )
    case 'parkering':
    case 'bilplats':
      return (
        <Badge variant="outline" className={badgeClass}>
          Parkering
        </Badge>
      )
    case 'lokal':
      return (
        <Badge variant="outline" className={badgeClass}>
          Lokal
        </Badge>
      )
    case 'ovrigt':
    case 'övrigt':
      return (
        <Badge variant="outline" className={badgeClass}>
          Övrigt
        </Badge>
      )
    default:
      return type ? (
        <Badge variant="outline" className={badgeClass}>
          {type}
        </Badge>
      ) : (
        <span className="text-muted-foreground">-</span>
      )
  }
}

// Secondary Rental Badge
export const SecondaryRentalBadge = () => (
  <Badge
    variant="outline"
    className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200"
  >
    Andrahandsuthyrning
  </Badge>
)
