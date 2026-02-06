import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { BuildingEntrances } from '@/features/buildings/components/BuildingEntrances'
import { WorkOrdersManagement } from '@/features/work-orders/components/WorkOrdersManagement'
import { BuildingTabsMobile } from './BuildingTabsMobile'
import { MaintenanceUnitsTab } from '@/features/maintenance-units/components/MaintenanceUnitsTab'

import { useIsMobile } from '@/hooks/useMobile'
import { Building, Staircase } from '@/services/types'
import { useResidenceStaircaseLookupMap } from '@/features/residences/hooks/useResidenceStaircaseLookupMap'
import { DocumentsTab } from '@/features/documents/components/DocumentsTab'
import { ContextType } from '@/types/ui'

interface BuildingTabsProps {
  building: Building
  staircases: Staircase[]
  basePath: string
}

export const BuildingTabs = ({
  building,
  staircases,
  basePath,
}: BuildingTabsProps) => {
  const isMobile = useIsMobile()

  const { residenceStaircaseLookupMap, isLoading: isStaircasesLoading } =
    useResidenceStaircaseLookupMap(staircases)

  if (isMobile) {
    return (
      <BuildingTabsMobile
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
        <WorkOrdersManagement
          contextType={ContextType.Building}
          id={building.code}
        />
      </TabsContent>

      <TabsContent value="documents">
        <DocumentsTab contextType={ContextType.Building} id={building.id} />
      </TabsContent>
    </Tabs>
  )
}
