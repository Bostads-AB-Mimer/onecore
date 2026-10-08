import { useRouteTab } from '@onecore/ui'
import { BarChart3, Building, Home, Wrench } from 'lucide-react'

import { DocumentsTabContent } from '@/features/documents'
import { MaintenanceUnitsTabContent } from '@/features/maintenance-units'
import { PropertyBuildingsTabContent } from '@/features/properties'
import { PropertyStatisticsTabContent } from '@/features/properties'
import { WorkOrdersTabContent } from '@/features/work-orders'

import type { PropertyDetail } from '@/shared/types/api'
import { ContextType } from '@/shared/types/ui'
import {
  MobileAccordion,
  MobileAccordionItem,
} from '@/shared/ui/MobileAccordion'

import {
  PROPERTY_DEFAULT_TAB,
  PROPERTY_TABS,
  type PropertyTab,
} from '../model/tabs'

interface PropertyTabsMobileProps {
  propertyDetail: PropertyDetail
}

export const PropertyTabsMobile = ({
  propertyDetail,
}: PropertyTabsMobileProps) => {
  const { value } = useRouteTab(PROPERTY_TABS, PROPERTY_DEFAULT_TAB)
  const features = {
    showStatistics: true,
    showBuildings: true,
    showDocuments: true,
    showMaintenanceUnits: true,
    showWorkOrders: true,
  }

  type Item = MobileAccordionItem & { id: PropertyTab }
  const allItems: (Item | false)[] = [
    features.showStatistics && {
      id: 'sammanstallning',
      icon: BarChart3,
      title: 'Fastighetssammanställning',
      content: <PropertyStatisticsTabContent property={propertyDetail} />,
    },
    features.showBuildings && {
      id: 'byggnader',
      icon: Building,
      title: 'Byggnader',
      content: (
        <PropertyBuildingsTabContent buildings={propertyDetail.buildings} />
      ),
    },
    features.showMaintenanceUnits && {
      id: 'underhallsenheter',
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
      id: 'dokument',
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
      id: 'arenden',
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
  ]
  const accordionItems = allItems.filter((item): item is Item => item !== false)

  return (
    <MobileAccordion
      items={accordionItems}
      defaultOpen={[value]}
      className="space-y-3"
    />
  )
}
