import React from 'react'
import { Residence } from '@/services/types'
import { Hotel } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton } from '../ui/sidebar'

interface ResidenceNavigationProps {
  residence: Residence
  onSelect: () => void
}

export function ResidenceNavigation({ residence, onSelect }: ResidenceNavigationProps) {
  const navigate = useNavigate()

  return (
    <SidebarMenuItem>
      <SidebarMenuButton 
        onClick={() => {
          onSelect()
          navigate(`/residences/${residence.id}`)
        }}
        tooltip={residence.name}
      >
        <Hotel />
        <span>LGH-{residence.code}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
