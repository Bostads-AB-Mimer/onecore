import { useQuery } from '@tanstack/react-query'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/v2/Tabs'
import { Card, CardContent } from '@/components/ui/v2/Card'
import {
  ClipboardList,
  Info,
  MessageSquare,
  Users,
  FileText,
  Map,
  Folder,
  Lock,
  Wrench,
} from 'lucide-react'

import { useIsMobile } from '@/hooks/useMobile'
import { useToast } from '@/hooks/useToast'
import { Lease, inspectionService } from '@/services/api/core'
import { components } from '@/services/api/core/generated/api-types'
import { ContextType } from '@/types/ui'

import { RoomInfo } from '@/features/residences/components/RoomInfo'
import { TenantInformation } from '@/features/residences/components/TenantInformation'
import { ResidenceFloorplan } from '@/features/residences/components/ResidenceFloorplan'
import { InspectionsList } from '@/features/residences/components/InspectionsList'
import { RentalBlocksTab } from '@/features/residences'

import { WorkOrdersManagement } from '@/features/work-orders/components/WorkOrdersManagement'
import { MaintenanceUnitsTab } from '@/features/maintenance-units/components/MaintenanceUnitsTab'
import { RentalObjectContracts } from '@/components/rental-object/RentalObjectContracts'
import { DocumentsTab } from '@/features/documents/components/DocumentsTab'

import { ResidenceTabsMobile } from './ResidenceTabsMobile'

type Residence = components['schemas']['ResidenceDetails']
type Tenant = NonNullable<components['schemas']['Lease']['tenants']>[number]

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
  const { toast } = useToast()

  const inspectionsQuery = useQuery({
    queryKey: ['inspections', residence.propertyObject.rentalId],
    queryFn: () =>
      inspectionService.getInspectionsForResidence(
        residence.propertyObject.rentalId!
      ),
    enabled: !!residence.propertyObject.rentalId,
  })

  const inspections = inspectionsQuery.data ?? []
  const tenant: Tenant | null = null

  const handleInspectionCreated = () => {
    toast({
      description: 'Besiktningen har skapats',
    })
  }

  const rentalId = residence.propertyObject.rentalId ?? ''

  if (isMobile) {
    return (
      <ResidenceTabsMobile
        residence={residence}
        currentLease={currentLease}
        leasesIsLoading={leasesIsLoading}
        leasesError={leasesError}
        inspections={inspections}
        tenant={tenant}
        onInspectionCreated={handleInspectionCreated}
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
        <TabsTrigger value="tenant" className="flex items-center gap-1.5">
          <Users className="h-4 w-4" />
          <span className="hidden sm:inline">Hyresgäst</span>
        </TabsTrigger>
        <TabsTrigger value="contracts" className="flex items-center gap-1.5">
          <FileText className="h-4 w-4" />
          <span className="hidden sm:inline">Kontrakt</span>
        </TabsTrigger>
        <TabsTrigger value="workorders" className="flex items-center gap-1.5">
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
        <TabsTrigger value="maintenance" className="flex items-center gap-1.5">
          <Wrench className="h-4 w-4" />
          <span className="hidden sm:inline">Underhållsenheter</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="rooms">
        <Card>
          <CardContent className="p-4">
            <RoomInfo residenceId={residence.id} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="floorplan">
        <ResidenceFloorplan rentalId={rentalId} />
      </TabsContent>

      <TabsContent value="inspections">
        <Card>
          <CardContent className="p-4">
            <InspectionsList
              residenceId={residence.id}
              inspections={inspections}
              onInspectionCreated={handleInspectionCreated}
              tenant={tenant}
              residence={residence}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="tenant">
        <Card>
          <CardContent className="p-4">
            <TenantInformation
              isLoading={leasesIsLoading}
              error={leasesError}
              lease={currentLease}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="contracts">
        {rentalId && <RentalObjectContracts rentalPropertyId={rentalId} />}
      </TabsContent>

      <TabsContent value="workorders">
        {rentalId && (
          <WorkOrdersManagement
            contextType={ContextType.Residence}
            id={rentalId}
          />
        )}
      </TabsContent>

      <TabsContent value="documents">
        <DocumentsTab contextType={ContextType.Residence} id={residence.id} />
      </TabsContent>

      <TabsContent value="rental-blocks">
        <RentalBlocksTab rentalId={rentalId} />
      </TabsContent>

      <TabsContent value="maintenance">
        <MaintenanceUnitsTab
          contextType="residence"
          identifier={rentalId || undefined}
          showFlatList
        />
      </TabsContent>
    </Tabs>
  )
}
