import { Building } from '@/services/types'
import { SidebarMenu } from '@/shared/ui/Sidebar'
import { StaircaseNavigation } from './Staircase'
import { NavigationSkeleton } from './NavigationSkeleton'
import { NavigationError } from './NavigationError'
import { useStaircases } from '@/features/buildings'

interface StaircaseListProps {
  building: Building
  onStaircaseSelect?: (staircaseId: string) => void
}

export function StaircaseList({ building }: StaircaseListProps) {
  const { data: staircases, isLoading, error } = useStaircases(building.code)

  if (isLoading) return <NavigationSkeleton />
  if (error) return <NavigationError label="staircases" />

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
