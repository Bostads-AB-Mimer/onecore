import { useResidences, useResidencesByStaircase } from '@/features/residences'

import { Building } from '@/services/types'

import { numericCompare } from '@/shared/lib/sorting'
import { NavigationError, NavigationSkeleton } from '@/shared/ui/layout'
import { SidebarMenu } from '@/shared/ui/Sidebar'

import { ResidenceNavigation } from './Residence'

interface ResidenceListProps {
  building: Building
  staircaseCode?: string
  propertyCode?: string
  organizationNumber?: string
}

export function ResidenceList({
  building,
  staircaseCode,
  propertyCode,
  organizationNumber,
}: ResidenceListProps) {
  const allResidencesQuery = useResidences(building.code, !staircaseCode)
  const staircaseResidencesQuery = useResidencesByStaircase(
    building.code,
    staircaseCode
  )

  const {
    data: residences,
    isLoading,
    error,
  } = staircaseCode ? staircaseResidencesQuery : allResidencesQuery

  if (isLoading) return <NavigationSkeleton />
  if (error) return <NavigationError label="residences" />

  const sortedResidences = residences?.slice().sort((a, b) => {
    if (!staircaseCode) {
      const staircaseCompare = numericCompare(a.staircaseCode, b.staircaseCode)
      if (staircaseCompare !== 0) return staircaseCompare
    }
    return numericCompare(a.rentalId, b.rentalId)
  })

  return (
    <div>
      <SidebarMenu>
        {sortedResidences?.map((residence) => (
          <ResidenceNavigation
            key={residence.id}
            residence={residence}
            buildingCode={building.code}
            staircaseCode={staircaseCode ?? residence.staircaseCode}
            propertyCode={propertyCode}
            organizationNumber={organizationNumber}
          />
        ))}
      </SidebarMenu>
    </div>
  )
}
