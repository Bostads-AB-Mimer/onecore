import { Building, Home, BarChart3, Wrench } from 'lucide-react'

import { PropertyBuildingsTabContent } from '@/features/properties'
import { PropertyStatisticsTabContent } from '@/features/properties'
import { MaintenanceUnitsTabContent } from '@/features/maintenance-units'
import { DocumentsTabContent } from '@/features/documents'
import { WorkOrdersTabContent } from '@/features/work-orders'

import {
  MobileAccordion,
  MobileAccordionItem,
} from '@/shared/ui/MobileAccordion'
import type { PropertyDetail } from '@/shared/types/api'
import { ContextType } from '@/shared/types/ui'

interface PropertyTabsMobileProps {
  propertyDetail: PropertyDetail
}

export const PropertyTabsMobile = ({
  propertyDetail,
}: PropertyTabsMobileProps) => {
  const features = {
    showStatistics: true,
    showBuildings: true,
    showDocuments: true,
    showMaintenanceUnits: true,
    showWorkOrders: true,
  }

  const accordionItems: MobileAccordionItem[] = [
    features.showStatistics && {
      id: 'statistics',
      icon: BarChart3,
      title: 'Fastighetssammanställning',
      content: <PropertyStatisticsTabContent property={propertyDetail} />,
    },
    features.showBuildings && {
      id: 'buildings',
      icon: Building,
      title: 'Byggnader',
      content: (
        <PropertyBuildingsTabContent buildings={propertyDetail.buildings} />
      ),
    },
    features.showMaintenanceUnits && {
      id: 'maintenance-units',
      icon: Wrench,
      title: 'Underhållsenheter',
      content: (
        <MaintenanceUnitsTabContent
          contextType="property"
          identifier={propertyDetail.code}
        />
      ),
    },
    features.showDocuments && {
      id: 'documents',
      icon: Home,
      title: 'Dokument',
      content: (
        <DocumentsTabContent
          contextType={ContextType.Property}
          id={propertyDetail.id}
        />
      ),
    },
    features.showWorkOrders && {
      id: 'work-orders',
      icon: Home,
      title: 'Ärenden',
      content: (
        <WorkOrdersTabContent
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
