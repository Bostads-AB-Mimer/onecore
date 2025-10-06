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
import { BuildingPartsTab } from './tabs/BuildingPartsTab'
import { BuildingDocumentsTab } from './tabs/BuildingDocumentsTab'
import { BuildingOrdersTab } from './tabs/BuildingOrdersTab'
//import { Notes } from '@/components/shared/Notes'
import {
  MobileAccordion,
  MobileAccordionItem,
} from '@/components/ui/MobileAccordion'
import { FeatureGatedContent } from '@/components/shared/FeatureGatedContent'
import { Building as BuildingType, Staircase } from '@/services/types'
import { useFeatureToggles } from '@/contexts/FeatureTogglesContext'

interface BuildingDetailTabsMobileProps {
  building: BuildingType
  staircases: Staircase[]
  basePath: string
}

export const BuildingDetailTabsMobile = ({
  building,
  staircases,
  basePath,
}: BuildingDetailTabsMobileProps) => {
  const { features } = useFeatureToggles()
  const accordionItems: MobileAccordionItem[] = [
    features.showBuildingEntrances && {
      id: 'entrances',
      icon: Building,
      title: 'Uppgångar',
      content: features.showBuildingEntrances ? (
        <BuildingEntrances staircases={staircases} basePath={basePath} />
      ) : (
        <FeatureGatedContent
          isEnabled={false}
          fallbackMessage="Uppgångsfunktionen är inte aktiverad. Aktivera den i betainställningarna för att se innehållet."
        >
          <div />
        </FeatureGatedContent>
      ),
    },
    features.showBuildingParts && {
      id: 'parts',
      icon: Wrench,
      title: 'Byggnadsdelar',
      content: (
        <FeatureGatedContent
          isEnabled={features.showBuildingParts}
          fallbackMessage="Byggnadsdelarfunktionen är inte aktiverad. Aktivera den i betainställningarna för att se innehållet."
        >
          <BuildingPartsTab building={building} />
        </FeatureGatedContent>
      ),
    },
    features.showBuildingDocuments && {
      id: 'documents',
      disabled: true,
      icon: FileText,
      title: 'Dokument',
      content: (
        <FeatureGatedContent
          isEnabled={features.showBuildingDocuments}
          fallbackMessage="Dokumentfunktionen är inte aktiverad. Aktivera den i betainställningarna för att se innehållet."
        >
          <BuildingDocumentsTab />
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
