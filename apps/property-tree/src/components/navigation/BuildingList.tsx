import { Property } from '@/services/types'
import { Skeleton } from '@/components/ui/Skeleton'
import { SidebarMenu } from '@/components/ui/Sidebar'
import { BuildingNavigation } from './Building'
import { useQuery } from '@tanstack/react-query'
import { buildingService } from '@/services/api/core'

interface BuildingListProps {
  property: Property
  companyId?: string
}

export function BuildingList({ property, companyId }: BuildingListProps) {
  const {
    data: buildings,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['buildings', property.id],
    queryFn: () => buildingService.getByPropertyCode(property.code),
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
      `Failed to load buildings for property ${property.id}:`,
      error
    )
    return (
      <div className="text-sm text-destructive px-2">
        Failed to load buildings
      </div>
    )
  }

  return (
    <SidebarMenu>
      {buildings?.map((building) => (
        <BuildingNavigation
          key={building.code}
          property={property}
          building={building}
          companyId={companyId}
        />
      ))}
    </SidebarMenu>
  )
}
