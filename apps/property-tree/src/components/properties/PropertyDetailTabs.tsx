import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { PropertyBuildingsTab } from './tabs/PropertyBuildingsTab'
import { PropertyStatisticsTab } from './tabs/PropertyStatisticsTab'
import { MaintenanceUnitsTab } from '@/components/object-pages/MaintenanceUnitsTab'
import { PropertyOrdersTab } from './tabs/PropertyOrdersTab'
import { PropertyDetailTabsMobile } from './PropertyDetailTabsMobile'
import { useIsMobile } from '@/components/hooks/useMobile'
import type { PropertyDetail } from '@/types/api'
import { DocumentsTab } from '../documents/DocumentsTab'
import { ContextType } from '@/types/ui'

interface PropertyDetailTabsProps {
  propertyDetail: PropertyDetail // Replace 'any' with the actual type if available
}

export const PropertyDetailTabs = ({
  propertyDetail,
}: PropertyDetailTabsProps) => {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <PropertyDetailTabsMobile propertyDetail={propertyDetail} />
  }

  return (
    <Tabs defaultValue="statistics" className="space-y-6">
      <TabsList className="bg-slate-100/70 p-1 rounded-lg overflow-x-auto">
        <TabsTrigger value="statistics">Fastighetssammanställning</TabsTrigger>
        <TabsTrigger value="documents">Dokument</TabsTrigger>
        <TabsTrigger value="buildings">Byggnader</TabsTrigger>
        <TabsTrigger value="maintenance">Underhållsenheter</TabsTrigger>
        <TabsTrigger value="orders">Ärenden</TabsTrigger>
      </TabsList>

      <TabsContent value="statistics">
        <PropertyStatisticsTab property={propertyDetail} />
      </TabsContent>

      <TabsContent value="documents">
        <DocumentsTab
          contextType={ContextType.Property}
          id={propertyDetail.id}
        />
      </TabsContent>

      <TabsContent value="buildings">
        <PropertyBuildingsTab buildings={propertyDetail.buildings} />
      </TabsContent>

      <TabsContent value="maintenance">
        <MaintenanceUnitsTab
          contextType="property"
          identifier={propertyDetail.code}
        />
      </TabsContent>

      <TabsContent value="orders">
        <PropertyOrdersTab propertyDetail={propertyDetail} />
      </TabsContent>
    </Tabs>
  )
}
