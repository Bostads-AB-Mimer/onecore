import { useRouteTab } from '@onecore/ui'
import {
  ClipboardList,
  FileText,
  Folder,
  Info,
  KeyRound,
  Lock,
  Map,
  MessageSquare,
  Receipt,
  Users,
  Wrench,
} from 'lucide-react'

import { DocumentsTabContent } from '@/features/documents'
import { InspectionsTabContent } from '@/features/inspections'
import { LeasesTabContent } from '@/features/leases'
import { MaintenanceUnitsTabContent } from '@/features/maintenance-units'
import { RentRowsTabContent } from '@/features/rent-rows'
import { RentalBlocksTabContent } from '@/features/rental-blocks'
import { ResidenceFloorplanTabsContent } from '@/features/residences'
import { TenantsTabContent } from '@/features/tenants'
import { WorkOrdersTabContent } from '@/features/work-orders'

import { RentalObjectKeys } from '@/entities/component/ui/RentalObjectKeys'

import { Lease } from '@/services/api/core'
import { components } from '@/services/api/core/generated/api-types'

import { ContextType } from '@/shared/types/ui'
import {
  MobileAccordion,
  MobileAccordionItem,
} from '@/shared/ui/MobileAccordion'

import { RESIDENCE_DEFAULT_TAB, RESIDENCE_TABS } from '../model/tabs'
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
  const { value } = useRouteTab(RESIDENCE_TABS, RESIDENCE_DEFAULT_TAB)
  const rentalId = residence.propertyObject.rentalId ?? ''

  const accordionItems: MobileAccordionItem[] = [
    {
      id: 'rum',
      icon: Info,
      title: 'Rumsinformation',
      content: rentalId ? <RoomsTabContent rentalId={rentalId} /> : null,
    },
    {
      id: 'bofaktablad',
      icon: Map,
      title: 'Bofaktablad',
      content: <ResidenceFloorplanTabsContent rentalId={rentalId} />,
    },
    {
      id: 'besiktningar',
      icon: ClipboardList,
      title: 'Besiktningar',
      content: (
        <InspectionsTabContent
          rentalId={rentalId || undefined}
          residence={residence}
        />
      ),
    },
    {
      id: 'hyresgast',
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
      id: 'kontrakt',
      icon: FileText,
      title: 'Kontrakt',
      content: <LeasesTabContent rentalPropertyId={rentalId} />,
    },
    {
      id: 'hyresrader',
      icon: Receipt,
      title: 'Hyresrader',
      content: rentalId ? (
        <RentRowsTabContent rentalObjectCode={rentalId} lease={currentLease} />
      ) : null,
    },
    {
      id: 'nycklar',
      icon: KeyRound,
      title: 'Nycklar',
      content: rentalId ? (
        <RentalObjectKeys rentalObjectCode={rentalId} />
      ) : null,
    },
    {
      id: 'arenden',
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
      id: 'dokument',
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
      id: 'sparrar',
      icon: Lock,
      title: 'Spärrar',
      content: <RentalBlocksTabContent rentalId={rentalId} />,
    },
    {
      id: 'underhallsenheter',
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
      defaultOpen={[value]}
      className="space-y-3"
    />
  )
}
