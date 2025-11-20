import { Info, Building, Home, BarChart3, Wrench } from 'lucide-react'
import { PropertyInfoTab } from './tabs/PropertyInfoTab'
import { PropertyDocumentsTab } from './tabs/PropertyDocumentsTab'
import { PropertyPlanningTab } from './tabs/PropertyPlanningTab'
import { PropertyBuildingsTab } from './tabs/PropertyBuildingsTab'
//import { PropertyMapTab } from './tabs/PropertyMapTab'
import { PropertyStatisticsTab } from './tabs/PropertyStatisticsTab'
import { PropertyMaintenanceUnitsTab } from './tabs/PropertyMaintenanceUnitsTab'
import { PropertyOrdersTab } from './tabs/PropertyOrdersTab'
//import { PropertyAccessTab } from './tabs/PropertyAccessTab'
import {
  MobileAccordion,
  MobileAccordionItem,
} from '@/components/ui/MobileAccordion'
//import { useFeatureToggles } from "@/contexts/FeatureTogglesContext";
import type { PropertyDetail } from '@/types/api'

interface PropertyDetailTabsMobileProps {
  propertyDetail: PropertyDetail
}

export const PropertyDetailTabsMobile = ({
  propertyDetail,
}: PropertyDetailTabsMobileProps) => {
  //const { features } = useFeatureToggles();

  const features = {
    showPropertyInfo: false,
    showPropertyStatistics: true,
    showPropertyDocuments: false,
    showPropertyPlanning: false,
    showPropertyBuildings: true,
    showPropertyMaintenance: true,
    showPropertyOrders: true,
    showPropertyAccess: false,
    showPropertyMap: false,
  }

  const accordionItems: MobileAccordionItem[] = [
    features.showPropertyInfo && {
      id: 'info',
      icon: Info,
      title: 'Fastighet',
      content: <PropertyInfoTab property={propertyDetail} />,
    },
    features.showPropertyStatistics && {
      id: 'statistics',
      icon: BarChart3,
      title: 'Fastighetssammanställning',
      content: <PropertyStatisticsTab property={propertyDetail} />,
    },
    features.showPropertyBuildings && {
      id: 'buildings',
      icon: Building,
      title: 'Byggnader',
      content: <PropertyBuildingsTab buildings={propertyDetail.buildings} />,
    },
    features.showPropertyMaintenance && {
      id: 'maintenance',
      icon: Wrench,
      title: 'Underhållsenheter',
      content: <PropertyMaintenanceUnitsTab propertyDetail={propertyDetail} />,
    },
    /*
    features.showPropertyDocuments && {
      id: 'documents',
      icon: FileText,
      title: 'Dokument',
      content: <PropertyDocumentsTab />,
    },
    features.showPropertyPlanning && {
      id: 'planning',
      icon: Calendar,
      title: 'Planerat underhåll',
      content: <PropertyPlanningTab />,
    },
    */

    features.showPropertyOrders && {
      id: 'orders',
      icon: Home,
      title: 'Ärenden',
      content: <PropertyOrdersTab propertyDetail={propertyDetail} />,
    },

    /*
    features.showPropertyAccess && {
      id: 'access',
      icon: KeyRound,
      title: 'Lås & passage',
      content: <PropertyAccessTab />,
    },
    features.showPropertyMap && {
      id: 'map',
      icon: Map,
      title: 'Ritningar',
      content: <PropertyMapTab propertyDetail={propertyDetail} />,
    },
    */
  ].filter(Boolean) as MobileAccordionItem[]

  return (
    <MobileAccordion
      items={accordionItems}
      defaultOpen={['info']}
      className="space-y-3"
    />
  )
}
