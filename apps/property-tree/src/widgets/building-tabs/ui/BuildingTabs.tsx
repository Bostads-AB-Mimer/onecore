import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/v2/Tabs'
import { BuildingEntrancesTabContent } from '@/features/buildings'
import { WorkOrdersTabContent } from '@/features/work-orders'
import { DocumentsTabContent } from '@/features/documents'
import { MaintenanceUnitsTabContent } from '@/features/maintenance-units'

import { BuildingTabsMobile } from './BuildingTabsMobile'

import { useIsMobile } from '@/hooks/useMobile'
import { Building, Staircase } from '@/services/types'
import { useResidenceStaircaseLookupMap } from '@/features/residences'

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
        <TabsTrigger value="maintenance-units">Underhållsenheter</TabsTrigger>
        <TabsTrigger value="work-orders">Ärenden</TabsTrigger>
        <TabsTrigger value="documents">Dokument</TabsTrigger>
      </TabsList>

      <TabsContent value="entrances">
        <BuildingEntrancesTabContent
          isLoading={isStaircasesLoading}
          residenceStaircaseLookupMap={residenceStaircaseLookupMap}
          basePath={basePath}
        />
      </TabsContent>

      <TabsContent value="maintenance-units">
        <MaintenanceUnitsTabContent
          contextType="building"
          identifier={building.code}
        />
      </TabsContent>

      <TabsContent value="work-orders">
        <WorkOrdersTabContent
          contextType={ContextType.Building}
          id={building.code}
        />
      </TabsContent>

      <TabsContent value="documents">
        <DocumentsTabContent
          contextType={ContextType.Building}
          id={building.id}
        />
      </TabsContent>
    </Tabs>
  )
}
