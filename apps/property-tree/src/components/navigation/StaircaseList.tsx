import { Building } from '@/services/types'
import { Skeleton } from '@/components/ui/Skeleton'
import { SidebarMenu } from '@/components/ui/Sidebar'
import { StaircaseNavigation } from './Staircase'
import { useQuery } from '@tanstack/react-query'
import { GET } from '@/services/api/baseApi'

interface StaircaseListProps {
  building: Building
  onStaircaseSelect?: (staircaseId: string) => void
}

export function StaircaseList({ building }: StaircaseListProps) {
  const {
    data: staircases,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['staircases', building.id],
    queryFn: async () => {
      const { data, error } = await GET('/staircases', {
        params: { query: { buildingCode: building.code } },
      })
      if (error) throw error
      return data?.content
    },
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
      `Failed to load staircases for building ${building.id}:`,
      error
    )
    return (
      <div className="text-sm text-destructive px-2">
        Failed to load staircases
      </div>
    )
  }

  return (
    <SidebarMenu>
      {staircases?.map((staircase) => (
        <StaircaseNavigation
          key={staircase.id}
          staircase={staircase}
          building={building}
        />
      ))}
    </SidebarMenu>
  )
}
