import { useStaircases } from '@/features/buildings'

import { Building } from '@/services/types'

import { numericCompare } from '@/shared/lib/sorting'
import { NavigationError, NavigationSkeleton } from '@/shared/ui/layout'
import { SidebarMenu } from '@/shared/ui/Sidebar'

import { StaircaseNavigation } from './Staircase'

interface StaircaseListProps {
  building: Building
  propertyCode?: string
  organizationNumber?: string
}

export function StaircaseList({
  building,
  propertyCode,
  organizationNumber,
}: StaircaseListProps) {
  const { data: staircases, isLoading, error } = useStaircases(building.code)

  if (isLoading) return <NavigationSkeleton />
  if (error) return <NavigationError label="staircases" />

  const sortedStaircases = staircases
    ?.slice()
    .sort((a, b) => numericCompare(a.code, b.code))

  return (
    <SidebarMenu>
      {sortedStaircases?.map((staircase) => (
        <StaircaseNavigation
          key={staircase.id}
          staircase={staircase}
          building={building}
          propertyCode={propertyCode}
          organizationNumber={organizationNumber}
        />
      ))}
    </SidebarMenu>
  )
}
