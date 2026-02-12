import { Link } from 'react-router-dom'
import { Residence } from '@/services/types'
import { Hotel } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton } from '@/shared/ui/Sidebar'
import { useHierarchicalSelection } from '../hooks/useHierarchicalSelection'
import { useScrollToSelected } from '@/shared/hooks/useScrollToSelected'
import { toTitleCase } from '@/shared/lib/textUtils'

interface ResidenceNavigationProps {
  residence: Residence
  buildingCode: string
  staircaseCode: string
  propertyId?: string
  companyId?: string
}

export function ResidenceNavigation({
  residence,
  buildingCode,
  staircaseCode,
  propertyId,
  companyId,
}: ResidenceNavigationProps) {
  const { isResidenceSelected } = useHierarchicalSelection()

  const isSelected = isResidenceSelected(residence.id)

  const scrollRef = useScrollToSelected<HTMLLIElement>({
    isSelected,
    itemType: 'residence',
  })

  return (
    <SidebarMenuItem ref={scrollRef}>
      <SidebarMenuButton asChild tooltip={residence.name} isActive={isSelected}>
        <Link
          to={`/residences/${residence.id}`}
          state={{ buildingCode, staircaseCode, propertyId, companyId }}
        >
          <Hotel />
          <span>LGH-{toTitleCase(residence.code)}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
