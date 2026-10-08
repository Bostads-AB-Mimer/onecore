import type { ReactNode } from 'react'
import { SegmentedTabs, useRouteTab } from '@onecore/ui'

import { BuildingEntrancesTabContent } from '@/features/buildings'
import { DocumentsTabContent } from '@/features/documents'
import { MaintenanceUnitsTabContent } from '@/features/maintenance-units'
import { useResidenceStaircaseLookupMap } from '@/features/residences'
import { WorkOrdersTabContent } from '@/features/work-orders'

import { Building, Staircase } from '@/services/types'

import { useIsMobile } from '@/shared/hooks'
import { ContextType } from '@/shared/types/ui'
import { TabsAccordion } from '@/shared/ui/TabsAccordion'

import {
  BUILDING_DEFAULT_TAB,
  BUILDING_TABS,
  type BuildingTab,
} from '../model/tabs'

interface BuildingTabsProps {
  building: Building
  staircases: Staircase[]
}

export const BuildingTabs = ({ building, staircases }: BuildingTabsProps) => {
  const isMobile = useIsMobile()
  const { value, basePath } = useRouteTab(BUILDING_TABS, BUILDING_DEFAULT_TAB)

  const { residenceStaircaseLookupMap, isLoading: isStaircasesLoading } =
    useResidenceStaircaseLookupMap(staircases)

  const content: Record<BuildingTab, ReactNode> = {
    uppgangar: (
      <BuildingEntrancesTabContent
        isLoading={isStaircasesLoading}
        residenceStaircaseLookupMap={residenceStaircaseLookupMap}
      />
    ),
    underhallsenheter: (
      <MaintenanceUnitsTabContent
        contextType="building"
        identifier={building.code}
      />
    ),
    arenden: (
      <WorkOrdersTabContent
        contextType={ContextType.Building}
        id={building.code}
      />
    ),
    dokument: (
      <DocumentsTabContent
        contextType={ContextType.Building}
        id={building.id}
      />
    ),
  }

  if (isMobile) {
    return <TabsAccordion tabs={BUILDING_TABS} content={content} open={value} />
  }

  return (
    <div className="space-y-6">
      <SegmentedTabs tabs={BUILDING_TABS} value={value} basePath={basePath} />
      {content[value]}
    </div>
  )
}
