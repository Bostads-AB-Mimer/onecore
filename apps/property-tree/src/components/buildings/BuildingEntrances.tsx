import { Staircase } from '@/services/types'
import { BuildingEntranceHierarchy } from './BuildingEntranceHierarchy'
import { TabLayout } from '@/components/ui/TabLayout'
import { useResidenceStaircaseLookupMap } from '../hooks/useResidenceStaircaseLookupMap'

interface BuildingEntrancesProps {
  staircases: Staircase[]
  basePath: string
}

export const BuildingEntrances = ({
  staircases,
  basePath,
}: BuildingEntrancesProps) => {
  const residenceStaircaseLookupMap = useResidenceStaircaseLookupMap(staircases)

  return (
    <TabLayout
      title="Uppgångar"
      count={staircases?.length || 0}
      showCard={true}
    >
      <BuildingEntranceHierarchy
        residenceStaircaseLookupMap={residenceStaircaseLookupMap}
        staircases={staircases}
        basePath={basePath}
      />
    </TabLayout>
  )
}
