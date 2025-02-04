import { Residence } from '@/services/types'
import { Hotel } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar'
import { useNavigate } from 'react-router-dom'

interface ResidenceNavigationProps {
  residence: Residence
  buildingCode: string
  floorCode: string
}

export function ResidenceNavigation({
  residence,
  buildingCode,
  floorCode,
}: ResidenceNavigationProps) {
  const navigate = useNavigate()

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => {
          navigate(`/residences/${residence.id}`, {
            state: {
              buildingCode,
              floorCode,
            },
          })
        }}
        tooltip={residence.name}
      >
        <Hotel />
        <span>LGH-{residence.code}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
