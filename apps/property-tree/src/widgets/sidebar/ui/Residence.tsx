import { Link } from 'react-router-dom'
import { Hotel } from 'lucide-react'

import { ResidenceSummary } from '@/services/types'

import { useScrollToSelected } from '@/shared/hooks/useScrollToSelected'
import { toTitleCase } from '@/shared/lib/textUtils'
import { paths } from '@/shared/routes'
import { SidebarMenuButton, SidebarMenuItem } from '@/shared/ui/Sidebar'

import { useHierarchicalSelection } from '../hooks/useHierarchicalSelection'

interface ResidenceNavigationProps {
  residence: ResidenceSummary
  buildingCode: string
  staircaseCode: string
  propertyCode?: string
  companyId?: string
}

export function ResidenceNavigation({
  residence,
  buildingCode,
  staircaseCode,
  propertyCode,
  companyId,
}: ResidenceNavigationProps) {
  const { isResidenceSelected } = useHierarchicalSelection()

  const isSelected = isResidenceSelected(residence.rentalId)

  const scrollRef = useScrollToSelected<HTMLLIElement>({
    isSelected,
    itemType: 'residence',
  })

  return (
    <SidebarMenuItem ref={scrollRef}>
      <SidebarMenuButton asChild tooltip={residence.name} isActive={isSelected}>
        <Link
          to={paths.residence(residence.rentalId)}
          state={{ buildingCode, staircaseCode, propertyCode, companyId }}
        >
          <Hotel />
          <span>LGH-{toTitleCase(residence.code)}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
