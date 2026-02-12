import { Home, Car, Building2, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { SearchDropdownDisplayFormat } from '@/components/ui/search-dropdown'

type SearchDisplay = Pick<SearchDropdownDisplayFormat, 'icon' | 'badge'>

const iconClass = 'h-4 w-4 text-muted-foreground'

const rentalTypeDisplay: Record<string, SearchDisplay> = {
  Bostad: {
    icon: <Home className={iconClass} />,
    badge: <Badge variant="secondary">LGH</Badge>,
  },
  Bilplats: {
    icon: <Car className={iconClass} />,
    badge: <Badge variant="secondary">P</Badge>,
  },
  Lokal: {
    icon: <Building2 className={iconClass} />,
    badge: <Badge variant="secondary">Lokal</Badge>,
  },
}

const contactDisplay: SearchDisplay = {
  icon: <User className={iconClass} />,
  badge: <Badge variant="outline">Kontakt</Badge>,
}

/**
 * Get icon + badge for a rental object type (Bostad, Bilplats, Lokal)
 */
export function getRentalSearchDisplay(type: string): SearchDisplay {
  return rentalTypeDisplay[type] ?? {}
}

/**
 * Get icon + badge for a contact search result
 */
export function getContactSearchDisplay(): SearchDisplay {
  return contactDisplay
}
