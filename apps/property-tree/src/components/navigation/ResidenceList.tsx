import { Building } from '@/services/types'
import { Skeleton } from '@/components/ui/Skeleton'
import { SidebarMenu } from '@/components/ui/Sidebar'
import { ResidenceNavigation } from './Residence'
import { useQuery } from '@tanstack/react-query'
import { residenceService } from '@/services/api/core'

interface ResidenceListProps {
  building: Building
  propertyId?: string
  companyId?: string
  staircaseCode?: string
}

export function ResidenceList({
  building,
  propertyId,
  companyId,
  staircaseCode,
}: ResidenceListProps) {
  const {
    data: residences,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['residences', building.id, staircaseCode],
    queryFn: () =>
      residenceService.getByBuildingCodeAndStaircaseCode(
        building.code,
        staircaseCode || ''
      ),
  })

  if (isLoading) {
    return (
      <>
        <Skeleton className="h-8 mx-2 mb-2" />
        <Skeleton className="h-8 mx-2" />
      </>
    )
  }

  if (error) {
    console.error(
      `Failed to load residences for building ${building.id}:`,
      error
    )
    return (
      <div className="text-sm text-destructive px-2">
        Failed to load residences
      </div>
    )
  }

  return (
    <div>
      <SidebarMenu>
        {residences?.map((residence) => (
          <ResidenceNavigation
            key={residence.id}
            residence={residence}
            buildingCode={residence.buildingCode || building.code}
            staircaseCode={residence.staircaseCode || staircaseCode || ''}
            propertyId={propertyId}
            companyId={companyId}
          />
        ))}
      </SidebarMenu>
    </div>
  )
}
