import React from 'react'
import { Building, Property } from '@/services/types'
import { Warehouse } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar'
import { ResidenceList } from './ResidenceList'
import { MapDialog } from '@/components/shared/MapDialog'
import { useQuery } from '@tanstack/react-query'
import { residenceService } from '@/services/api'

interface BuildingNavigationProps {
  building: Building
  property: Property
}

export function BuildingNavigation({
  building,
  property,
}: BuildingNavigationProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)

  const { data: residences } = useQuery({
    queryKey: ['residences', building.id],
    queryFn: () => residenceService.getByBuildingCode(building.code),
    enabled: isExpanded,
  })

  return (
    <SidebarMenuItem>
      <div className="flex items-center justify-between pr-2">
        <SidebarMenuButton
          onClick={() => setIsExpanded(!isExpanded)}
          tooltip={building.code}
        >
          <Warehouse />
          <span>{building.code}</span>
        </SidebarMenuButton>
        {isExpanded && residences && residences.length > 0 && (
          <MapDialog
            residences={residences.map((r) => ({
              code: r.code,
              name: `${building.name}`,
              address: `${building.name} ${building.code}`,
            }))}
          />
        )}
      </div>
      {isExpanded && (
        <div className="pl-4 mt-1">
          <ResidenceList building={building} />
        </div>
      )}
    </SidebarMenuItem>
  )
}
