import { ResidenceSummary } from '@/services/types'
import { BuildingEntranceHierarchy } from './BuildingEntrancesHierarchy'
import { TabLayout } from '@/shared/ui/layout/TabLayout'
import { UseQueryResult } from '@tanstack/react-query'

interface BuildingEntrancesTabContentProps {
  isLoading: boolean
  residenceStaircaseLookupMap: Record<
    string,
    UseQueryResult<ResidenceSummary[], Error>
  >
  basePath: string
}

export const BuildingEntrancesTabContent = ({
  isLoading,
  residenceStaircaseLookupMap,
  basePath,
}: BuildingEntrancesTabContentProps) => {
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
