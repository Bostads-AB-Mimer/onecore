import {
  ClipboardList,
  FileText,
  Info,
  MessageSquare,
  Users,
  Wrench,
} from 'lucide-react'

import { SpaceComponents } from '@/features/component-library'
import { LeasesTabContent } from '@/features/leases'
import { CurrentTenant } from '@/features/tenants'
import { WorkOrdersTabContent } from '@/features/work-orders'

import { components } from '@/services/api/core/generated/api-types'
import { Lease } from '@/services/api/core/leaseService'

import { ContextType } from '@/shared/types/ui'
import {
  MobileAccordion,
  MobileAccordionItem,
} from '@/shared/ui/MobileAccordion'

import { RoomsTabContent } from './RoomsTabContent'

type Facility = components['schemas']['FacilityDetails']

interface FacilityTabsMobileProps {
  facility: Facility
  leases?: Lease[]
  leasesIsLoading: boolean
}

export function FacilityTabsMobile({
  facility,
  leases,
  leasesIsLoading,
}: FacilityTabsMobileProps) {
  const rentalId = facility.rentalInformation?.rentalId

  const accordionItems: MobileAccordionItem[] = [
    {
      id: 'components',
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
      id: 'rooms',
      icon: Info,
      title: 'Rumsinformation',
      content: <RoomsTabContent facilityId={facility.id} />,
    },
    {
      id: 'tenant',
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
      id: 'leases',
      icon: FileText,
      title: 'Kontrakt',
      content: rentalId ? (
        <LeasesTabContent rentalPropertyId={rentalId} />
      ) : null,
    },
    {
      id: 'inspections',
      icon: ClipboardList,
      title: 'Besiktningar',
      disabled: true,
      content: null,
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
  ].filter((item) => item.content !== null)

  return (
    <MobileAccordion
      items={accordionItems}
      defaultOpen={['components']}
      className="space-y-3"
    />
  )
}
