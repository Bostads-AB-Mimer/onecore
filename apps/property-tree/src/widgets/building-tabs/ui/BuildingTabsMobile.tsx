import { useRouteTab } from '@onecore/ui'
import { UseQueryResult } from '@tanstack/react-query'
import { Building, FileText, MessageSquare, Wrench } from 'lucide-react'

import { BuildingEntrancesTabContent } from '@/features/buildings'
import { FeatureGatedContent } from '@/features/buildings/ui/FeatureGatedContent'
import { DocumentsTabContent } from '@/features/documents'
import { MaintenanceUnitsTabContent } from '@/features/maintenance-units'
import { WorkOrdersTabContent } from '@/features/work-orders'

import { Building as BuildingType, ResidenceSummary } from '@/services/types'

import { ContextType } from '@/shared/types/ui'
import {
  MobileAccordion,
  MobileAccordionItem,
} from '@/shared/ui/MobileAccordion'

import { useFeatureToggles } from '@/contexts/FeatureTogglesContext'

import {
  BUILDING_DEFAULT_TAB,
  BUILDING_TABS,
  type BuildingTab,
} from '../model/tabs'

interface BuildingTabsMobileProps {
  building: BuildingType
  isLoading: boolean
  residenceStaircaseLookupMap: Record<
    string,
    UseQueryResult<ResidenceSummary[], Error>
  >
}

export const BuildingTabsMobile = ({
  building,
  isLoading,
  residenceStaircaseLookupMap,
}: BuildingTabsMobileProps) => {
  const { value } = useRouteTab(BUILDING_TABS, BUILDING_DEFAULT_TAB)
  const { features } = useFeatureToggles()
  type Item = MobileAccordionItem & { id: BuildingTab }
  const allItems: (Item | false)[] = [
    features.showBuildingEntrances && {
      id: 'uppgangar',
      icon: Building,
      title: 'Uppgångar',
      content: features.showBuildingEntrances ? (
        <BuildingEntrancesTabContent
          isLoading={isLoading}
          residenceStaircaseLookupMap={residenceStaircaseLookupMap}
        />
      ) : (
        <FeatureGatedContent
          isEnabled={false}
          fallbackMessage="Uppgångsfunktionen är inte aktiverad. Aktivera den i betainställningarna för att se innehållet."
        >
          <div />
        </FeatureGatedContent>
      ),
    },
    {
      id: 'underhallsenheter',
      icon: Wrench,
      title: 'Underhållsenheter',
      content: (
        <MaintenanceUnitsTabContent
          contextType="building"
          identifier={building.code}
        />
      ),
    },
    {
      id: 'arenden',
      icon: MessageSquare,
      title: 'Ärenden',
      content: (
        <WorkOrdersTabContent
          contextType={ContextType.Building}
          id={building.code}
        />
      ),
    },
    {
      id: 'dokument',
      icon: FileText,
      title: 'Dokument',
      content: (
        <DocumentsTabContent
          contextType={ContextType.Building}
          id={building.id}
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
