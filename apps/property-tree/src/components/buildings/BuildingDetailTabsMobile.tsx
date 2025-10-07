import {
  Building,
  Wrench,
  FileText,
  Users,
  Car,
  Home,
  MessageSquare,
  StickyNote,
} from 'lucide-react'
import { BuildingEntrances } from './BuildingEntrances'
import { BuildingOrdersTab } from './tabs/BuildingOrdersTab'
import {
  MobileAccordion,
  MobileAccordionItem,
} from '@/components/ui/MobileAccordion'
import { FeatureGatedContent } from '@/components/shared/FeatureGatedContent'
import { Building as BuildingType, ResidenceSummary } from '@/services/types'
import { useFeatureToggles } from '@/contexts/FeatureTogglesContext'
import { UseQueryResult } from '@tanstack/react-query'

interface BuildingDetailTabsMobileProps {
  building: BuildingType
  isLoading: boolean
  residenceStaircaseLookupMap: Record<
    string,
    UseQueryResult<ResidenceSummary[], Error>
  >
  basePath: string
}

export const BuildingDetailTabsMobile = ({
  building,
  isLoading,
  residenceStaircaseLookupMap,
  basePath,
}: BuildingDetailTabsMobileProps) => {
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
      id: 'orders',
      disabled: true,
      icon: MessageSquare,
      title: 'Ärenden',
      content: <BuildingOrdersTab building={building} />,
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
