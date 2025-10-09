import { Residence, ResidenceSummary, Staircase } from '@/services/types'
import { BuildingEntranceHierarchy } from './BuildingEntranceHierarchy'
import { TabLayout } from '@/components/ui/TabLayout'
import { useResidenceStaircaseLookupMap } from '../hooks/useResidenceStaircaseLookupMap'
import { UseQueryResult } from '@tanstack/react-query'

interface BuildingEntrancesProps {
  isLoading: boolean
  residenceStaircaseLookupMap: Record<
    string,
    UseQueryResult<ResidenceSummary[], Error>
  >
  basePath: string
}

export const BuildingEntrances = ({
  isLoading,
  residenceStaircaseLookupMap,
  basePath,
}: BuildingEntrancesProps) => {
  const count = !isLoading
    ? Object.entries(residenceStaircaseLookupMap).filter(([, queryResult]) => {
        return queryResult.data && queryResult.data.length > 0
      }).length
    : undefined

  return (
    <TabLayout title="Uppgångar" count={count} showCard={true}>
      <BuildingEntranceHierarchy
        isLoading={isLoading}
        residenceStaircaseLookupMap={residenceStaircaseLookupMap}
        basePath={basePath}
      />
    </TabLayout>
  )
}
