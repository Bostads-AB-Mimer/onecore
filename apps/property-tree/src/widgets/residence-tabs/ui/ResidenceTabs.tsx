import {
  ClipboardList,
  FileText,
  Folder,
  Info,
  Lock,
  Map,
  MessageSquare,
  Users,
  Wrench,
} from 'lucide-react'

import { DocumentsTabContent } from '@/features/documents'
import { InspectionsTabContent } from '@/features/inspections'
import { LeasesTabContent } from '@/features/leases'
import { MaintenanceUnitsTabContent } from '@/features/maintenance-units'
import { RentalBlocksTabContent } from '@/features/rental-blocks'
import { ResidenceFloorplanTabsContent } from '@/features/residences'
import { TenantsTabContent } from '@/features/tenants'
import { WorkOrdersTabContent } from '@/features/work-orders'

import { Lease } from '@/services/api/core'
import { components } from '@/services/api/core/generated/api-types'

import { useIsMobile } from '@/shared/hooks/useMobile'
import { ContextType } from '@/shared/types/ui'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/Tabs'

import { ResidenceTabsMobile } from './ResidenceTabsMobile'
import { RoomsTabContent } from './RoomsTabContent'

type Residence = components['schemas']['ResidenceDetails']

interface ResidenceTabsProps {
  residence: Residence
  currentLease?: Lease
  leasesIsLoading: boolean
  leasesError: Error | null
}

export const ResidenceTabs = ({
  residence,
  currentLease,
  leasesIsLoading,
  leasesError,
}: ResidenceTabsProps) => {
  const isMobile = useIsMobile()
  const rentalId = residence.propertyObject.rentalId ?? ''

  if (isMobile) {
    return (
      <ResidenceTabsMobile
        residence={residence}
        currentLease={currentLease}
        leasesIsLoading={leasesIsLoading}
        leasesError={leasesError}
      />
    )
  }

  return (
    <Tabs defaultValue="rooms" className="w-full">
      <TabsList className="mb-4 bg-slate-100/70 p-1 rounded-lg">
        <TabsTrigger value="rooms" className="flex items-center gap-1.5">
          <Info className="h-4 w-4" />
          <span className="hidden sm:inline">Rumsinformation</span>
        </TabsTrigger>
        <TabsTrigger value="floorplan" className="flex items-center gap-1.5">
          <Map className="h-4 w-4" />
          <span className="hidden sm:inline">Bofaktablad</span>
        </TabsTrigger>
        <TabsTrigger value="inspections" className="flex items-center gap-1.5">
          <ClipboardList className="h-4 w-4" />
          <span className="hidden sm:inline">Besiktningar</span>
        </TabsTrigger>
        <TabsTrigger value="tenants" className="flex items-center gap-1.5">
          <Users className="h-4 w-4" />
          <span className="hidden sm:inline">Hyresgäst</span>
        </TabsTrigger>
        <TabsTrigger value="work-orders" className="flex items-center gap-1.5">
          <MessageSquare className="h-4 w-4" />
          <span className="hidden sm:inline">Ärenden</span>
        </TabsTrigger>
        <TabsTrigger value="documents" className="flex items-center gap-1.5">
          <Folder className="h-4 w-4" />
          <span className="hidden sm:inline">Dokument</span>
        </TabsTrigger>
        <TabsTrigger
          value="rental-blocks"
          className="flex items-center gap-1.5"
        >
          <Lock className="h-4 w-4" />
          <span className="hidden sm:inline">Spärrar</span>
        </TabsTrigger>
        <TabsTrigger
          value="maintenance-units"
          className="flex items-center gap-1.5"
        >
          <Wrench className="h-4 w-4" />
          <span className="hidden sm:inline">Underhållsenheter</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="rooms">
        <RoomsTabContent residenceId={residence.id} />
      </TabsContent>

      <TabsContent value="floorplan">
        <ResidenceFloorplanTabsContent rentalId={rentalId} />
      </TabsContent>

      <TabsContent value="inspections">
        <InspectionsTabContent
          residenceId={residence.id}
          rentalId={residence.propertyObject.rentalId ?? undefined}
          leaseId={currentLease?.leaseId}
          residence={residence}
        />
      </TabsContent>

      <TabsContent value="tenants">
        <TenantsTabContent
          isLoading={leasesIsLoading}
          error={leasesError}
          lease={currentLease}
        />
      </TabsContent>

      <TabsContent value="work-orders">
        {rentalId && (
          <WorkOrdersTabContent
            contextType={ContextType.Residence}
            id={rentalId}
          />
        )}
      </TabsContent>

      <TabsContent value="documents">
        <DocumentsTabContent
          contextType={ContextType.Residence}
          id={residence.id}
        />
      </TabsContent>

      <TabsContent value="rental-blocks">
        <RentalBlocksTabContent rentalId={rentalId} />
      </TabsContent>

      <TabsContent value="maintenance-units">
        <MaintenanceUnitsTabContent
          contextType="residence"
          identifier={rentalId || undefined}
          showFlatList
        />
      </TabsContent>
    </Tabs>
  )
}
