import { Residence } from '@/services/types'
import { Hotel } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton } from '@/components/ui/Sidebar'
import { useNavigate } from 'react-router-dom'

interface ResidenceNavigationProps {
  residence: Residence
  buildingCode: string
  staircaseCode: string
}

export function ResidenceNavigation({
  residence,
  buildingCode,
  staircaseCode,
}: ResidenceNavigationProps) {
  const navigate = useNavigate()

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => {
          navigate(`/residences/${residence.id}`, {
            state: {
              buildingCode,
              staircaseCode,
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
