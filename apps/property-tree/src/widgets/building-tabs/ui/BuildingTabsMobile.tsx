import { Building, Wrench, FileText, MessageSquare } from 'lucide-react'
import { BuildingEntrancesTabContent } from '@/features/buildings'
import { WorkOrdersTabContent } from '@/features/work-orders'
import { MaintenanceUnitsTabContent } from '@/features/maintenance-units'
import { DocumentsTabContent } from '@/features/documents'
import {
  MobileAccordion,
  MobileAccordionItem,
} from '@/shared/ui/MobileAccordion'
import { FeatureGatedContent } from '@/features/buildings/ui/FeatureGatedContent'
import { Building as BuildingType, ResidenceSummary } from '@/services/types'
import { useFeatureToggles } from '@/contexts/FeatureTogglesContext'
import { UseQueryResult } from '@tanstack/react-query'

import { ContextType } from '@/shared/types/ui'

interface BuildingTabsMobileProps {
  building: BuildingType
  isLoading: boolean
  residenceStaircaseLookupMap: Record<
    string,
    UseQueryResult<ResidenceSummary[], Error>
  >
  basePath: string
}

export const BuildingTabsMobile = ({
  building,
  isLoading,
  residenceStaircaseLookupMap,
  basePath,
}: BuildingTabsMobileProps) => {
  const { features } = useFeatureToggles()
  const accordionItems: MobileAccordionItem[] = [
    features.showBuildingEntrances && {
      id: 'entrances',
      icon: Building,
      title: 'Uppgångar',
      content: features.showBuildingEntrances ? (
        <BuildingEntrancesTabContent
          isLoading={isLoading}
          residenceStaircaseLookupMap={residenceStaircaseLookupMap}
          basePath={basePath}
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
      id: 'maintenance-units',
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
      id: 'work-orders',
      disabled: true,
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
      id: 'documents',
      disabled: true,
      icon: FileText,
      title: 'Dokument',
      content: (
        <DocumentsTabContent
          contextType={ContextType.Building}
          id={building.id}
        />
      ),
    },
  ].filter(Boolean) as MobileAccordionItem[]

  return (
    <MobileAccordion
      items={accordionItems}
      defaultOpen={['entrances']}
      className="space-y-3"
    />
  )
}
