import { Info, Building, Home, BarChart3, Wrench } from 'lucide-react'
import { PropertyInfoTab } from '@/features/properties/components/tabs/PropertyInfoTab'
import { PropertyBuildingsTab } from '@/features/properties/components/tabs/PropertyBuildingsTab'
import { PropertyStatisticsTab } from '@/features/properties/components/tabs/PropertyStatisticsTab'
import { MaintenanceUnitsTab } from '@/features/maintenance-units/components/MaintenanceUnitsTab'
import { WorkOrdersManagement } from '@/features/work-orders/components/WorkOrdersManagement'
import {
  MobileAccordion,
  MobileAccordionItem,
} from '@/components/ui/MobileAccordion'
import type { PropertyDetail } from '@/types/api'
import { ContextType } from '@/types/ui'

interface PropertyDetailTabsMobileProps {
  propertyDetail: PropertyDetail
}

export const PropertyDetailTabsMobile = ({
  propertyDetail,
}: PropertyDetailTabsMobileProps) => {
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
      content: (
        <MaintenanceUnitsTab
          contextType="property"
          identifier={propertyDetail.code}
        />
      ),
    },
    features.showPropertyOrders && {
      id: 'orders',
      icon: Home,
      title: 'Ärenden',
      content: (
        <WorkOrdersManagement
          contextType={ContextType.Property}
          metadata={{ propertyName: propertyDetail.designation }}
          id={propertyDetail.code}
        />
      ),
    },
  ].filter(Boolean) as MobileAccordionItem[]

  return (
    <MobileAccordion
      items={accordionItems}
      defaultOpen={['info']}
      className="space-y-3"
    />
  )
}
