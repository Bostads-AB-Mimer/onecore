import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { TabLayout } from '@/components/ui/TabLayout'
import { BuildingEntrances } from './BuildingEntrances'
import { BuildingPartsTab } from './tabs/BuildingPartsTab'
import { BuildingSpacesTab } from './tabs/BuildingSpacesTab'
import { BuildingInstallationsTab } from './tabs/BuildingInstallationsTab'
import { BuildingParkingTab } from './tabs/BuildingParkingTab'
import { BuildingDocumentsTab } from './tabs/BuildingDocumentsTab'
import { BuildingOrdersTab } from './tabs/BuildingOrdersTab'
import { BuildingDetailTabsMobile } from './BuildingDetailTabsMobile'
//import { Notes } from '@/components/shared/Notes'
import { FeatureGatedContent } from '@/components/shared/FeatureGatedContent'
import { MessageSquare } from 'lucide-react'

import { useFeatureToggles } from '@/contexts/FeatureTogglesContext'
import { useIsMobile } from '@/components/hooks/useMobile'
import { useEffect } from 'react'
import { Building, Residence, Staircase } from '@/services/types'

interface BuildingDetailTabsProps {
  building: Building
  staircases: Staircase[]
  residences: Residence[]
  basePath: string
}

export const BuildingDetailTabs = ({
  building,
  staircases,
  residences,
  basePath,
}: BuildingDetailTabsProps) => {
  const { features } = useFeatureToggles()
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <BuildingDetailTabsMobile
        building={building}
        staircases={staircases}
        basePath={basePath}
      />
    )
  }

  return (
    <Tabs defaultValue="entrances" className="space-y-6">
      <TabsList className="bg-slate-100/70 p-1 rounded-lg overflow-x-auto">
        <TabsTrigger value="entrances">Uppgångar</TabsTrigger>

        <TabsTrigger disabled={true} value="parts">
          Byggnadsdelar
        </TabsTrigger>

        <TabsTrigger disabled={true} value="spaces">
          Utrymmen
        </TabsTrigger>

        <TabsTrigger disabled={true} value="documents">
          Dokument
        </TabsTrigger>

        <TabsTrigger disabled={true} value="orders">
          Ärenden
        </TabsTrigger>
      </TabsList>

      <TabsContent value="entrances">
        <FeatureGatedContent
          isEnabled={features.showBuildingEntrances}
          fallbackMessage="Uppgångsfunktionen är inte aktiverad. Aktivera den i betainställningarna för att se innehållet."
        >
          <BuildingEntrances staircases={staircases} basePath={basePath} />
        </FeatureGatedContent>
      </TabsContent>

      <TabsContent value="parts">
        <FeatureGatedContent
          isEnabled={features.showBuildingParts}
          fallbackMessage="Byggnadsdelarfunktionen är inte aktiverad. Aktivera den i betainställningarna för att se innehållet."
        >
          <BuildingPartsTab building={building} />
        </FeatureGatedContent>
      </TabsContent>

      <TabsContent value="documents">
        <FeatureGatedContent
          isEnabled={features.showBuildingDocuments}
          fallbackMessage="Dokumentfunktionen är inte aktiverad. Aktivera den i betainställningarna för att se innehållet."
        >
          <BuildingDocumentsTab />
        </FeatureGatedContent>
      </TabsContent>

      <TabsContent value="orders">
        <FeatureGatedContent
          isEnabled={true}
          fallbackMessage="Ärendefunktionen är inte aktiverad."
        >
          <BuildingOrdersTab building={building} />
        </FeatureGatedContent>
      </TabsContent>
    </Tabs>
  )
}
