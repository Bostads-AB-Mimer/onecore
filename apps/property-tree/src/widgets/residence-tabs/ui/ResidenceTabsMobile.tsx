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

import { ContextType } from '@/shared/types/ui'
import {
  MobileAccordion,
  MobileAccordionItem,
} from '@/shared/ui/MobileAccordion'

import { RoomsTabContent } from './RoomsTabContent'

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
