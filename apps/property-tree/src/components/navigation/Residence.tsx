import { Residence } from '@/services/types'
import { Hotel } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton } from '@/components/ui/Sidebar'
import { useNavigate } from 'react-router-dom'
import { useHierarchicalSelection } from '@/components/hooks/useHierarchicalSelection'
import { useScrollToSelected } from '@/components/hooks/useScrollToSelected'

interface ResidenceNavigationProps {
  residence: Residence
  buildingId: string
  buildingCode: string
  staircaseCode: string
  propertyId?: string
  companyId?: string
}

export function ResidenceNavigation({
  residence,
  buildingId,
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

  return (
    <SidebarMenuItem ref={scrollRef}>
      <SidebarMenuButton
        onClick={() => {
          if (propertyId && buildingId) {
            navigate(
              `/properties/${propertyId}/buildings/${buildingId}/residences/${residence.id}`,
              {
                state: {
                  buildingCode,
                  staircaseCode,
                  propertyId: propertyId,
                  companyId: companyId,
                },
              }
            )
          } else {
            // Fallback to old URL structure if IDs are missing
            navigate(`/residences/${residence.id}`, {
              state: {
                buildingCode,
                staircaseCode,
                propertyId: propertyId,
                companyId: companyId,
              },
            })
          }
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
