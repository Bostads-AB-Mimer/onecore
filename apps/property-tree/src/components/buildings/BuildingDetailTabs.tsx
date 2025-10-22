import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { BuildingEntrances } from './BuildingEntrances'
import { BuildingOrdersTab } from './tabs/BuildingOrdersTab'
import { BuildingDetailTabsMobile } from './BuildingDetailTabsMobile'

import { useIsMobile } from '@/components/hooks/useMobile'
import { Building, Staircase } from '@/services/types'
import { useResidenceStaircaseLookupMap } from '../hooks/useResidenceStaircaseLookupMap'

interface BuildingDetailTabsProps {
  building: Building
  staircases: Staircase[]
  basePath: string
}

export const BuildingDetailTabs = ({
  building,
  staircases,
  basePath,
}: BuildingDetailTabsProps) => {
  const isMobile = useIsMobile()

  const { residenceStaircaseLookupMap, isLoading: isStaircasesLoading } =
    useResidenceStaircaseLookupMap(staircases)

  if (isMobile) {
    return (
      <BuildingDetailTabsMobile
        isLoading={isStaircasesLoading}
        building={building}
        residenceStaircaseLookupMap={residenceStaircaseLookupMap}
        basePath={basePath}
      />
    )
  }

  return (
    <Tabs defaultValue="entrances" className="space-y-6">
      <TabsList className="bg-slate-100/70 p-1 rounded-lg overflow-x-auto">
        <TabsTrigger value="entrances">Uppgångar</TabsTrigger>
        <TabsTrigger value="orders">Ärenden</TabsTrigger>
      </TabsList>

      <TabsContent value="entrances">
        <BuildingEntrances
          isLoading={isStaircasesLoading}
          residenceStaircaseLookupMap={residenceStaircaseLookupMap}
          basePath={basePath}
        />
      </TabsContent>

      <TabsContent value="orders">
        <BuildingOrdersTab building={building} />
      </TabsContent>
    </Tabs>
  )
}
