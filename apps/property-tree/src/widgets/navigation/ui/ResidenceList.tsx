import { Building } from '@/services/types'
import { SidebarMenu } from '@/components/ui/Sidebar'
import { ResidenceNavigation } from './Residence'
import { NavigationSkeleton } from './NavigationSkeleton'
import { NavigationError } from './NavigationError'
import { useResidences } from '@/features/residences'

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
