import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { BuildingEntrances } from './BuildingEntrances'
import { BuildingWorkOrdersTab } from './BuildingWorkOrdersTab'
import { BuildingDetailTabsMobile } from './BuildingDetailTabsMobile'
import { MaintenanceUnitsTab } from '@/features/maintenance-units/components/MaintenanceUnitsTab'

import { useIsMobile } from '@/hooks/useMobile'
import { Building, Staircase } from '@/services/types'
import { useResidenceStaircaseLookupMap } from '@/hooks/useResidenceStaircaseLookupMap'
import { DocumentsTab } from '@/components/documents/DocumentsTab'
import { ContextType } from '@/types/ui'

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
        <TabsTrigger value="maintenance">Underhållsenheter</TabsTrigger>
        <TabsTrigger value="orders">Ärenden</TabsTrigger>
        <TabsTrigger value="documents">Dokument</TabsTrigger>
      </TabsList>

      <TabsContent value="entrances">
        <BuildingEntrances
          isLoading={isStaircasesLoading}
          residenceStaircaseLookupMap={residenceStaircaseLookupMap}
          basePath={basePath}
        />
      </TabsContent>

      <TabsContent value="maintenance">
        <MaintenanceUnitsTab
          contextType="building"
          identifier={building.code}
        />
      </TabsContent>

      <TabsContent value="orders">
        <BuildingWorkOrdersTab building={building} />
      </TabsContent>

      <TabsContent value="documents">
        <DocumentsTab contextType={ContextType.Building} id={building.id} />
      </TabsContent>
    </Tabs>
  )
}
