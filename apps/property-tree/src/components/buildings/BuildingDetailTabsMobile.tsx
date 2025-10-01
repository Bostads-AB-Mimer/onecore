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
import { BuildingSpacesTab } from './tabs/BuildingSpacesTab'
import { BuildingInstallationsTab } from './tabs/BuildingInstallationsTab'
import { BuildingParkingTab } from './tabs/BuildingParkingTab'
import { BuildingDocumentsTab } from './tabs/BuildingDocumentsTab'
import { BuildingOrdersTab } from './tabs/BuildingOrdersTab'
//import { Notes } from '@/components/shared/Notes'
import {
  MobileAccordion,
  MobileAccordionItem,
} from '@/components/ui/MobileAccordion'
import { FeatureGatedContent } from '@/components/shared/FeatureGatedContent'
//import { useFeatureToggles } from "@/contexts/FeatureTogglesContext";
import type { Building as BuildingType } from '@/types/api'

interface BuildingDetailTabsMobileProps {
  building: BuildingType
  basePath: string
}

export const BuildingDetailTabsMobile = ({
  building,
  basePath,
}: BuildingDetailTabsMobileProps) => {
  //const { features } = useFeatureToggles();

  const features = {
    showBuildingEntrances: true,
    showBuildingParts: false,
    showBuildingSpaces: false,
    showBuildingInstallations: false,
    showBuildingParking: false,
    showBuildingDocuments: false,
  }

  const accordionItems: MobileAccordionItem[] = [
    features.showBuildingEntrances && {
      id: 'entrances',
      icon: Building,
      title: 'Uppgångar',
      content: features.showBuildingEntrances ? (
        <BuildingEntrances building={building} basePath={basePath} />
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
    features.showBuildingSpaces && {
      id: 'spaces',
      icon: Users,
      title: 'Utrymmen',
      content: (
        <FeatureGatedContent
          isEnabled={features.showBuildingSpaces}
          fallbackMessage="Utrymmenfunktionen är inte aktiverad. Aktivera den i betainställningarna för att se innehållet."
        >
          <BuildingSpacesTab building={building} />
        </FeatureGatedContent>
      ),
    },
    features.showBuildingInstallations && {
      id: 'installations',
      icon: Wrench,
      title: 'Installationer',
      content: (
        <FeatureGatedContent
          isEnabled={features.showBuildingInstallations}
          fallbackMessage="Installationerfunktionen är inte aktiverad. Aktivera den i betainställningarna för att se innehållet."
        >
          <BuildingInstallationsTab building={building} />
        </FeatureGatedContent>
      ),
    },
    features.showBuildingParking && {
      id: 'parking',
      icon: Car,
      title: 'Parkering',
      content: (
        <FeatureGatedContent
          isEnabled={features.showBuildingParking}
          fallbackMessage="Parkeringfunktionen är inte aktiverad. Aktivera den i betainställningarna för att se innehållet."
        >
          <BuildingParkingTab building={building} />
        </FeatureGatedContent>
      ),
    },
    features.showBuildingDocuments && {
      id: 'documents',
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
      icon: MessageSquare,
      title: 'Ärenden',
      content: <BuildingOrdersTab building={building} />,
    },
    /*
    {
      id: 'notes',
      icon: StickyNote,
      title: 'Noteringar',
      content: (
        <Notes
          entityType="building"
          entityId={building.id}
          placeholder="Skriv din notering här..."
          emptyMessage="Inga noteringar har lagts till för denna byggnad ännu."
        />
      ),
    },
    */
  ].filter(Boolean) as MobileAccordionItem[]

  return (
    <MobileAccordion
      items={accordionItems}
      defaultOpen={['orders']}
      className="space-y-3"
    />
  )
}
