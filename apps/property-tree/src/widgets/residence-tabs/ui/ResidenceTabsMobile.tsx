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

import {
  MobileAccordion,
  MobileAccordionItem,
} from '@/shared/ui/MobileAccordion'

import { Lease } from '@/services/api/core'
import { components } from '@/services/api/core/generated/api-types'
import { ContextType } from '@/shared/types/ui'

import { ResidenceFloorplanTabsContent } from '@/features/residences'
import { RentalBlocksTabContent } from '@/features/rental-blocks'
import { RoomsTabContent } from '@/widgets/rooms-tab'
import { TenantsTabContent } from '@/features/tenants'
import { InspectionsTabContent } from '@/features/inspections'
import { WorkOrdersTabContent } from '@/features/work-orders'
import { MaintenanceUnitsTabContent } from '@/features/maintenance-units'
import { LeasesTabContent } from '@/features/leases'
import { DocumentsTabContent } from '@/features/documents'

type Residence = components['schemas']['ResidenceDetails']

interface ResidenceTabsMobileProps {
  residence: Residence
  currentLease?: Lease
  leasesIsLoading: boolean
  leasesError: Error | null
}

export const ResidenceTabsMobile = ({
  residence,
  currentLease,
  leasesIsLoading,
  leasesError,
}: ResidenceTabsMobileProps) => {
  const rentalId = residence.propertyObject.rentalId ?? ''

  const accordionItems: MobileAccordionItem[] = [
    {
      id: 'rooms',
      icon: Info,
      title: 'Rumsinformation',
      content: <RoomsTabContent residenceId={residence.id} />,
    },
    {
      id: 'floorplan',
      icon: Map,
      title: 'Bofaktablad',
      content: <ResidenceFloorplanTabsContent rentalId={rentalId} />,
    },
    {
      id: 'inspections',
      icon: ClipboardList,
      title: 'Besiktningar',
      content: (
        <InspectionsTabContent
          residenceId={residence.id}
          rentalId={rentalId || undefined}
          residence={residence}
        />
      ),
    },
    {
      id: 'tenants',
      icon: Users,
      title: 'Hyresgäst',
      content: (
        <TenantsTabContent
          isLoading={leasesIsLoading}
          error={leasesError}
          lease={currentLease}
        />
      ),
    },
    {
      id: 'work-orders',
      icon: MessageSquare,
      title: 'Ärenden',
      content: rentalId ? (
        <WorkOrdersTabContent
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
        <DocumentsTabContent
          contextType={ContextType.Residence}
          id={residence.id}
        />
      ),
    },
    {
      id: 'rental-blocks',
      icon: Lock,
      title: 'Spärrar',
      content: <RentalBlocksTabContent rentalId={rentalId} />,
    },
    {
      id: 'maintenance-units',
      icon: Wrench,
      title: 'Underhållsenheter',
      content: (
        <MaintenanceUnitsTabContent
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
