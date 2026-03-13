import { ClipboardList, FileText, MessageSquare, Users } from 'lucide-react'

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

type ParkingSpace = components['schemas']['ParkingSpace']

interface ParkingSpaceTabsMobileProps {
  parkingSpace: ParkingSpace
  leases?: Lease[]
  leasesIsLoading: boolean
}

export function ParkingSpaceTabsMobile({
  parkingSpace,
  leases,
  leasesIsLoading,
}: ParkingSpaceTabsMobileProps) {
  const accordionItems: MobileAccordionItem[] = [
    {
      id: 'tenant',
      icon: Users,
      title: 'Hyresgäst',
      content: (
        <CurrentTenant
          rentalPropertyId={parkingSpace.rentalId}
          leases={leases}
          isLoading={leasesIsLoading}
        />
      ),
    },
    {
      id: 'leases',
      icon: FileText,
      title: 'Kontrakt',
      content: <LeasesTabContent rentalPropertyId={parkingSpace.rentalId} />,
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
      content: (
        <WorkOrdersTabContent
          contextType={ContextType.Residence}
          id={parkingSpace.rentalId}
        />
      ),
    },
  ].filter((item) => item.content !== null)

  return (
    <MobileAccordion
      items={accordionItems}
      defaultOpen={['tenant']}
      className="space-y-3"
    />
  )
}
