import { Building, Wrench, FileText, MessageSquare } from 'lucide-react'
import { BuildingEntrances } from '@/features/buildings/components/BuildingEntrances'
import { WorkOrdersManagement } from '@/features/work-orders/components/WorkOrdersManagement'
import { MaintenanceUnitsTab } from '@/features/maintenance-units/components/MaintenanceUnitsTab'
import {
  MobileAccordion,
  MobileAccordionItem,
} from '@/components/ui/MobileAccordion'
import { FeatureGatedContent } from '@/components/shared/FeatureGatedContent'
import { Building as BuildingType, ResidenceSummary } from '@/services/types'
import { useFeatureToggles } from '@/contexts/FeatureTogglesContext'
import { UseQueryResult } from '@tanstack/react-query'
import { DocumentsTab } from '@/features/documents/components/DocumentsTab'
import { ContextType } from '@/types/ui'

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
        <BuildingEntrances
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
      id: 'maintenance',
      icon: Wrench,
      title: 'Underhållsenheter',
      content: (
        <MaintenanceUnitsTab
          contextType="building"
          identifier={building.code}
        />
      ),
    },
    {
      id: 'orders',
      disabled: true,
      icon: MessageSquare,
      title: 'Ärenden',
      content: (
        <WorkOrdersManagement
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
        <DocumentsTab contextType={ContextType.Building} id={building.id} />
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
