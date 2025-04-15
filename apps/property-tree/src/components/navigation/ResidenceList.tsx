import { Building } from '@/services/types'
import { Skeleton } from '@/components/ui/Skeleton'
import { SidebarMenu } from '@/components/ui/Sidebar'
import { ResidenceNavigation } from './Residence'
import { useQuery } from '@tanstack/react-query'
import { residenceService } from '@/services/api'
import { MapDialog } from '@/components/shared/MapDialog'

interface ResidenceListProps {
  building: Building
}

export function ResidenceList({ building }: ResidenceListProps) {
  const {
    data: residences,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['residences', building.id],
    queryFn: () => residenceService.getByBuildingCode(building.code),
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
      <div className="flex justify-end mb-2 mr-2">
        {residences && residences.length > 0 && (
          <MapDialog
            residences={residences.map((r) => ({
              code: r.code,
              name: r.name,
              address: r.name,
            }))}
          />
        )}
      </div>
      <SidebarMenu>
        {residences?.map((residence) => (
          <ResidenceNavigation
            key={residence.id}
            residence={residence}
            buildingCode={building.code}
            staircaseCode={residence.code.split('-')[0]} // Assuming staircase code is first part of residence code
          />
        ))}
      </SidebarMenu>
    </div>
  )
}
