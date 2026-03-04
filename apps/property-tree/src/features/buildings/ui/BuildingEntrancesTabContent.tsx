import { UseQueryResult } from '@tanstack/react-query'

import { ResidenceSummary } from '@/services/types'

import { TabLayout } from '@/shared/ui/layout/TabLayout'

import { BuildingEntranceHierarchy } from './BuildingEntrancesHierarchy'

interface BuildingEntrancesTabContentProps {
  isLoading: boolean
  residenceStaircaseLookupMap: Record<
    string,
    UseQueryResult<ResidenceSummary[], Error>
  >
}

export const BuildingEntrancesTabContent = ({
  isLoading,
  residenceStaircaseLookupMap,
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
      />
    </TabLayout>
  )
}
