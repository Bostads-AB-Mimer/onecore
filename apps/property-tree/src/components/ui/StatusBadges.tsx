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
          Uppsagd
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

// Distrikt Badges
export const DistriktBadge = ({ distrikt }: { distrikt: string | null }) => {
  if (!distrikt) return <span className="text-muted-foreground">-</span>

  const label = distrikt.split(' ').slice(1).join(' ') || distrikt
  const normalized = distrikt.toLowerCase()

  if (normalized.includes('öst')) {
    return (
      <Badge
        variant="outline"
        className="bg-orange-50 text-orange-700 hover:bg-orange-50 border-orange-200"
      >
        {label}
      </Badge>
    )
  }
  if (normalized.includes('väst')) {
    return (
      <Badge
        variant="outline"
        className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200"
      >
        {label}
      </Badge>
    )
  }
  if (normalized.includes('mitt')) {
    return (
      <Badge
        variant="outline"
        className="bg-green-50 text-green-700 hover:bg-green-50 border-green-200"
      >
        {label}
      </Badge>
    )
  }
  if (normalized.includes('norr')) {
    return (
      <Badge
        variant="outline"
        className="bg-purple-50 text-purple-700 hover:bg-purple-50 border-purple-200"
      >
        {label}
      </Badge>
    )
  }
  if (normalized.includes('student')) {
    return (
      <Badge
        variant="outline"
        className="bg-yellow-50 text-yellow-700 hover:bg-yellow-50 border-yellow-200"
      >
        {label}
      </Badge>
    )
  }

  return (
    <Badge
      variant="outline"
      className="bg-white text-gray-900 hover:bg-white border-gray-300"
    >
      {label}
    </Badge>
  )
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
