import type { ReactNode } from 'react'
import { SegmentedTabs, useRouteTab } from '@onecore/ui'

import { DocumentsTabContent } from '@/features/documents'
import { MaintenanceUnitsTabContent } from '@/features/maintenance-units'
import { PropertyBuildingsTabContent } from '@/features/properties'
import { PropertyStatisticsTabContent } from '@/features/properties'
import { WorkOrdersTabContent } from '@/features/work-orders'

import { useIsMobile } from '@/shared/hooks/useMobile'
import type { PropertyDetail } from '@/shared/types/api'
import { ContextType } from '@/shared/types/ui'
import { TabsAccordion } from '@/shared/ui/TabsAccordion'

import {
  PROPERTY_DEFAULT_TAB,
  PROPERTY_TABS,
  type PropertyTab,
} from '../model/tabs'

interface PropertyTabsProps {
  propertyDetail: PropertyDetail
}

export const PropertyTabs = ({ propertyDetail }: PropertyTabsProps) => {
  const isMobile = useIsMobile()
  const { value, basePath } = useRouteTab(PROPERTY_TABS, PROPERTY_DEFAULT_TAB)

  const content: Record<PropertyTab, ReactNode> = {
    sammanstallning: <PropertyStatisticsTabContent property={propertyDetail} />,
    dokument: (
      <DocumentsTabContent
        contextType={ContextType.Property}
        id={propertyDetail.id}
      />
    ),
    byggnader: (
      <PropertyBuildingsTabContent buildings={propertyDetail.buildings} />
    ),
    underhallsenheter: (
      <MaintenanceUnitsTabContent
        contextType="property"
        identifier={propertyDetail.code}
      />
    ),
    arenden: (
      <WorkOrdersTabContent
        contextType={ContextType.Property}
        metadata={{ propertyName: propertyDetail.designation }}
        id={propertyDetail.code}
      />
    ),
  }

  if (isMobile) {
    return <TabsAccordion tabs={PROPERTY_TABS} content={content} open={value} />
  }

  return (
    <div className="space-y-6">
      <SegmentedTabs tabs={PROPERTY_TABS} value={value} basePath={basePath} />
      {content[value]}
    </div>
  )
}
