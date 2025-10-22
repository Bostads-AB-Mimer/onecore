import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
//import { PropertyInfoTab } from './tabs/PropertyInfoTab'
import { PropertyDocumentsTab } from './tabs/PropertyDocumentsTab'
//import { PropertyPlanningTab } from './tabs/PropertyPlanningTab'
import { PropertyBuildingsTab } from './tabs/PropertyBuildingsTab'
//import { PropertyMapTab } from './tabs/PropertyMapTab'
import { PropertyStatisticsTab } from './tabs/PropertyStatisticsTab'
//import { PropertyMaintenanceUnitsTab } from './tabs/PropertyMaintenanceUnitsTab'
import { PropertyOrdersTab } from './tabs/PropertyOrdersTab'
//import { PropertyAccessTab } from './tabs/PropertyAccessTab'
import { PropertyDetailTabsMobile } from './PropertyDetailTabsMobile'
import { useIsMobile } from '@/components/hooks/useMobile'
//import { useFeatureToggles } from "@/contexts/FeatureTogglesContext";
import { FeatureGatedContent } from '@/components/shared/FeatureGatedContent'
import type { PropertyDetail } from '@/types/api'

interface PropertyDetailTabsProps {
  propertyDetail: PropertyDetail // Replace 'any' with the actual type if available
}

export const PropertyDetailTabs = ({
  propertyDetail,
}: PropertyDetailTabsProps) => {
  const isMobile = useIsMobile()
  //const { features } = useFeatureToggles();

  const features = {
    showPropertyInfo: true,
    showPropertyStatistics: true,
    showPropertyDocuments: false,
    showPropertyPlanning: false,
    showPropertyBuildings: true,
    showPropertyMaintenance: false,
    showPropertyOrders: true,
    showPropertyAccess: false,
    showPropertyMap: false,
  }

  if (isMobile) {
    return <PropertyDetailTabsMobile propertyDetail={propertyDetail} />
  }

  return (
    <Tabs defaultValue="statistics" className="space-y-6">
      <TabsList className="bg-slate-100/70 p-1 rounded-lg overflow-x-auto">
        {features.showPropertyStatistics && (
          <TabsTrigger value="statistics">
            Fastighetssammanställning
          </TabsTrigger>
        )}
        {features.showPropertyDocuments && (
          <TabsTrigger value="documents">Dokument</TabsTrigger>
        )}
        {features.showPropertyPlanning && (
          <TabsTrigger value="planning">Planerat underhåll</TabsTrigger>
        )}
        {features.showPropertyBuildings && (
          <TabsTrigger value="buildings">Byggnader</TabsTrigger>
        )}
        {features.showPropertyMaintenance && (
          <TabsTrigger value="maintenance">Underhållsenheter</TabsTrigger>
        )}
        {features.showPropertyOrders && (
          <TabsTrigger value="orders">Ärenden</TabsTrigger>
        )}
        {features.showPropertyAccess && (
          <TabsTrigger value="access">Lås & passage</TabsTrigger>
        )}
        {features.showPropertyMap && (
          <TabsTrigger value="map">Ritningar</TabsTrigger>
        )}
      </TabsList>

      {features.showPropertyStatistics && (
        <TabsContent value="statistics">
          <PropertyStatisticsTab property={propertyDetail} />
        </TabsContent>
      )}

      {/*
      {features.showPropertyDocuments && (
        <TabsContent value="documents">
          <FeatureGatedContent
            isEnabled={features.showPropertyDocuments}
            fallbackMessage="För att se dokument, aktivera funktionen i inställningarna."
          >
            <PropertyDocumentsTab />
          </FeatureGatedContent>
        </TabsContent>
      )}


      {features.showPropertyPlanning && (
        <TabsContent value="planning">
          <FeatureGatedContent
            isEnabled={features.showPropertyPlanning}
            fallbackMessage="För att se planerat underhåll, aktivera funktionen i inställningarna."
          >
            <PropertyPlanningTab />
          </FeatureGatedContent>
        </TabsContent>
      )}
      */}

      {features.showPropertyBuildings && (
        <TabsContent value="buildings">
          <PropertyBuildingsTab buildings={propertyDetail.buildings} />
        </TabsContent>
      )}

      {/*
      {features.showPropertyMaintenance && (
        <TabsContent value="maintenance">
          <FeatureGatedContent
            isEnabled={features.showPropertyMaintenance}
            fallbackMessage="För att se underhållsenheter, aktivera funktionen i inställningarna."
          >
            <PropertyMaintenanceUnitsTab
              maintenanceUnits={propertyDetail.maintenanceUnits}
            />
          </FeatureGatedContent>
        </TabsContent>
      )}
        */}

      {features.showPropertyOrders && (
        <TabsContent value="orders">
          <PropertyOrdersTab propertyDetail={propertyDetail} />
        </TabsContent>
      )}

      {/*
      {features.showPropertyAccess && (
        <TabsContent value="access">
          <FeatureGatedContent
            isEnabled={features.showPropertyAccess}
            fallbackMessage="För att se lås & passage, aktivera funktionen i inställningarna."
          >
            <PropertyAccessTab />
          </FeatureGatedContent>
        </TabsContent>
      )}

      {features.showPropertyMap && (
        <TabsContent value="map">
          <FeatureGatedContent
            isEnabled={features.showPropertyMap}
            fallbackMessage="För att se ritningar, aktivera funktionen i inställningarna."
          >
            <PropertyMapTab propertyDetail={propertyDetail} />
          </FeatureGatedContent>
        </TabsContent>
      )}
        */}
    </Tabs>
  )
}
