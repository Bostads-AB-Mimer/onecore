import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/Tabs'

import { PropertyBuildingsTabContent } from '@/features/properties'
import { PropertyStatisticsTabContent } from '@/features/properties'
import { MaintenanceUnitsTabContent } from '@/features/maintenance-units'
import { DocumentsTabContent } from '@/features/documents'
import { WorkOrdersTabContent } from '@/features/work-orders'

import { PropertyTabsMobile } from './PropertyTabsMobile'
import { useIsMobile } from '@/shared/hooks/useMobile'
import type { PropertyDetail } from '@/shared/types/api'
import { ContextType } from '@/shared/types/ui'

interface PropertyTabsProps {
  propertyDetail: PropertyDetail
}

export const PropertyTabs = ({ propertyDetail }: PropertyTabsProps) => {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <PropertyTabsMobile propertyDetail={propertyDetail} />
  }

  return (
    <Tabs defaultValue="statistics" className="space-y-6">
      <TabsList className="bg-slate-100/70 p-1 rounded-lg overflow-x-auto">
        <TabsTrigger value="statistics">Fastighetssammanställning</TabsTrigger>
        <TabsTrigger value="documents">Dokument</TabsTrigger>
        <TabsTrigger value="buildings">Byggnader</TabsTrigger>
        <TabsTrigger value="maintenance-units">Underhållsenheter</TabsTrigger>
        <TabsTrigger value="work-orders">Ärenden</TabsTrigger>
      </TabsList>

      <TabsContent value="statistics">
        <PropertyStatisticsTabContent property={propertyDetail} />
      </TabsContent>

      <TabsContent value="documents">
        <DocumentsTabContent
          contextType={ContextType.Property}
          id={propertyDetail.id}
        />
      </TabsContent>

      <TabsContent value="buildings">
        <PropertyBuildingsTabContent buildings={propertyDetail.buildings} />
      </TabsContent>

      <TabsContent value="maintenance-units">
        <MaintenanceUnitsTabContent
          contextType="property"
          identifier={propertyDetail.code}
        />
      </TabsContent>

      <TabsContent value="work-orders">
        <WorkOrdersTabContent
          contextType={ContextType.Property}
          metadata={{ propertyName: propertyDetail.designation }}
          id={propertyDetail.code}
        />
      </TabsContent>
    </Tabs>
  )
}
