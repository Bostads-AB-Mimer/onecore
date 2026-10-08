import { useRouteTab } from '@onecore/ui'
import {
  ClipboardList,
  FileText,
  Info,
  MessageSquare,
  Receipt,
  Users,
  Wrench,
} from 'lucide-react'

import { SpaceComponents } from '@/features/component-library'
import { LeasesTabContent } from '@/features/leases'
import { RentRowsTabContent } from '@/features/rent-rows'
import { CurrentTenant } from '@/features/tenants'
import { WorkOrdersTabContent } from '@/features/work-orders'

import { components } from '@/services/api/core/generated/api-types'
import { Lease } from '@/services/api/core/leaseService'

import { ContextType } from '@/shared/types/ui'
import {
  MobileAccordion,
  MobileAccordionItem,
} from '@/shared/ui/MobileAccordion'

import { FACILITY_DEFAULT_TAB, FACILITY_TABS } from '../model/tabs'
import { RoomsTabContent } from './RoomsTabContent'

type Facility = components['schemas']['FacilityDetails']

interface FacilityTabsMobileProps {
  facility: Facility
  leases?: Lease[]
  leasesIsLoading: boolean
  currentLease?: Lease
}

export function FacilityTabsMobile({
  facility,
  leases,
  leasesIsLoading,
  currentLease,
}: FacilityTabsMobileProps) {
  const { value } = useRouteTab(FACILITY_TABS, FACILITY_DEFAULT_TAB)
  const rentalId = facility.rentalInformation?.rentalId

  const accordionItems: MobileAccordionItem[] = [
    {
      id: 'komponenter',
      icon: Wrench,
      title: 'Komponenter',
      content: (
        <SpaceComponents
          spaceId={facility.propertyObjectId}
          spaceName={facility.name || facility.code}
        />
      ),
    },
    {
      id: 'rum',
      icon: Info,
      title: 'Rumsinformation',
      content: <RoomsTabContent facilityId={facility.id} />,
    },
    {
      id: 'hyresgast',
      icon: Users,
      title: 'Hyresgäst',
      content: rentalId ? (
        <CurrentTenant
          rentalPropertyId={rentalId}
          leases={leases}
          isLoading={leasesIsLoading}
        />
      ) : null,
    },
    {
      id: 'kontrakt',
      icon: FileText,
      title: 'Kontrakt',
      content: rentalId ? (
        <LeasesTabContent rentalPropertyId={rentalId} />
      ) : null,
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
      id: 'besiktningar',
      icon: ClipboardList,
      title: 'Besiktningar',
      disabled: true,
      content: null,
    },
    {
      id: 'arenden',
      icon: MessageSquare,
      title: 'Ärenden',
      content: rentalId ? (
        <WorkOrdersTabContent
          contextType={ContextType.Facility}
          id={rentalId}
        />
      ) : null,
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
