import { ResidenceSummary } from '@/services/types'
import { Hotel } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton } from '@/components/ui/Sidebar'
import { useNavigate } from 'react-router-dom'
import { useHierarchicalSelection } from '@/components/hooks/useHierarchicalSelection'
import { useScrollToSelected } from '@/components/hooks/useScrollToSelected'

interface ResidenceNavigationProps {
  residence: ResidenceSummary
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
  const navigate = useNavigate()
  const { isResidenceSelected } = useHierarchicalSelection()

  const isSelected = isResidenceSelected(residence.id)

  const scrollRef = useScrollToSelected<HTMLLIElement>({
    isSelected: isSelected,
    itemType: 'residence',
  })

  const rentalId =
    residence.rentalId || `${buildingCode}-${staircaseCode}-${residence.code}`

  return (
    <SidebarMenuItem ref={scrollRef}>
      <SidebarMenuButton
        onClick={() => {
          navigate(`/residences/${rentalId}`, {
            state: {
              buildingCode,
              staircaseCode,
              propertyId: propertyId,
              companyId: companyId,
            },
          })
        }}
        tooltip={residence.name}
        isActive={isSelected}
      >
        <Hotel />
        <span>LGH-{residence.code}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
