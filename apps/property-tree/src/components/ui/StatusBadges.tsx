import { Badge } from '@/components/ui/v2/Badge'

/**
 * Reusable badges for consistent styling across the application
 */

// Lease Status Badge — re-exported from entity
export { LeaseStatusBadge } from '@/entities/lease'

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
