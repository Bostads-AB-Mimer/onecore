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

import { Card, CardContent } from '@/components/ui/v2/Card'
import {
  MobileAccordion,
  MobileAccordionItem,
} from '@/components/ui/MobileAccordion'

import { Lease } from '@/services/api/core'
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

type Residence = components['schemas']['ResidenceDetails']
type Tenant = NonNullable<components['schemas']['Lease']['tenants']>[number]
type Inspection = components['schemas']['Inspection']

interface ResidenceTabsMobileProps {
  residence: Residence
  currentLease?: Lease
  leasesIsLoading: boolean
  leasesError: Error | null
  inspections: Inspection[]
  tenant: Tenant | null
  onInspectionCreated: () => void
}

export const ResidenceTabsMobile = ({
  residence,
  currentLease,
  leasesIsLoading,
  leasesError,
  inspections,
  tenant,
  onInspectionCreated,
}: ResidenceTabsMobileProps) => {
  const rentalId = residence.propertyObject.rentalId ?? ''

  const accordionItems: MobileAccordionItem[] = [
    {
      id: 'rooms',
      icon: Info,
      title: 'Rumsinformation',
      content: (
        <Card>
          <CardContent className="p-4">
            <RoomInfo residenceId={residence.id} />
          </CardContent>
        </Card>
      ),
    },
    {
      id: 'floorplan',
      icon: Map,
      title: 'Bofaktablad',
      content: <ResidenceFloorplan rentalId={rentalId} />,
    },
    {
      id: 'inspections',
      icon: ClipboardList,
      title: 'Besiktningar',
      content: (
        <Card>
          <CardContent className="p-4">
            <InspectionsList
              residenceId={residence.id}
              inspections={inspections}
              onInspectionCreated={onInspectionCreated}
              tenant={tenant}
              residence={residence}
            />
          </CardContent>
        </Card>
      ),
    },
    {
      id: 'tenant',
      icon: Users,
      title: 'Hyresgäst',
      content: (
        <Card>
          <CardContent className="p-4">
            <TenantInformation
              isLoading={leasesIsLoading}
              error={leasesError}
              lease={currentLease}
            />
          </CardContent>
        </Card>
      ),
    },
    {
      id: 'contracts',
      icon: FileText,
      title: 'Kontrakt',
      content: rentalId ? (
        <RentalObjectContracts rentalPropertyId={rentalId} />
      ) : null,
    },
    {
      id: 'workorders',
      icon: MessageSquare,
      title: 'Ärenden',
      content: rentalId ? (
        <WorkOrdersManagement
          contextType={ContextType.Residence}
          id={rentalId}
        />
      ) : null,
    },
    {
      id: 'documents',
      icon: Folder,
      title: 'Dokument',
      content: (
        <DocumentsTab contextType={ContextType.Residence} id={residence.id} />
      ),
    },
    {
      id: 'rental-blocks',
      icon: Lock,
      title: 'Spärrar',
      content: <RentalBlocksTab rentalId={rentalId} />,
    },
    {
      id: 'maintenance',
      icon: Wrench,
      title: 'Underhållsenheter',
      content: (
        <MaintenanceUnitsTab
          contextType="residence"
          identifier={rentalId || undefined}
          showFlatList
        />
      ),
    },
  ].filter((item) => item.content !== null)

  return (
    <MobileAccordion
      items={accordionItems}
      defaultOpen={['rooms']}
      className="space-y-3"
    />
  )
}
