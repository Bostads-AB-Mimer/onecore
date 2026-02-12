import { useResidences } from '@/features/residences'

import { Building } from '@/services/types'

import { NavigationError, NavigationSkeleton } from '@/shared/ui/layout'
import { SidebarMenu } from '@/shared/ui/Sidebar'

import { ResidenceNavigation } from './Residence'

interface ResidenceListProps {
  building: Building
  propertyId?: string
  companyId?: string
}

export function ResidenceList({
  building,
  propertyId,
  companyId,
}: ResidenceListProps) {
  const { data: residences, isLoading, error } = useResidences(building.code)

  if (isLoading) return <NavigationSkeleton />
  if (error) return <NavigationError label="residences" />

  return (
    <div>
      <SidebarMenu>
        {residences?.map((residence) => (
          <ResidenceNavigation
            key={residence.id}
            residence={residence}
            buildingCode={building.code}
            staircaseCode={residence.code.split('-')[0]} // Assuming staircase code is first part of residence code
            propertyId={propertyId}
            companyId={companyId}
          />
        ))}
      </SidebarMenu>
    </div>
  )
}
