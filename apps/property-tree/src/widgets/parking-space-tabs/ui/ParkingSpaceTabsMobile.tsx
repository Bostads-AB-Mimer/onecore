import { useRouteTab } from '@onecore/ui'
import {
  ClipboardList,
  FileText,
  MessageSquare,
  Receipt,
  Users,
} from 'lucide-react'

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

import { PARKING_SPACE_DEFAULT_TAB, PARKING_SPACE_TABS } from '../model/tabs'

type ParkingSpace = components['schemas']['ParkingSpace']

interface ParkingSpaceTabsMobileProps {
  parkingSpace: ParkingSpace
  leases?: Lease[]
  leasesIsLoading: boolean
  currentLease?: Lease
}

export function ParkingSpaceTabsMobile({
  parkingSpace,
  leases,
  leasesIsLoading,
  currentLease,
}: ParkingSpaceTabsMobileProps) {
  const { value } = useRouteTab(PARKING_SPACE_TABS, PARKING_SPACE_DEFAULT_TAB)
  const accordionItems: MobileAccordionItem[] = [
    {
      id: 'hyresgast',
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
      id: 'kontrakt',
      icon: FileText,
      title: 'Kontrakt',
      content: <LeasesTabContent rentalPropertyId={parkingSpace.rentalId} />,
    },
    {
      id: 'hyresrader',
      icon: Receipt,
      title: 'Hyresrader',
      content: (
        <RentRowsTabContent
          rentalObjectCode={parkingSpace.rentalId}
          lease={currentLease}
        />
      ),
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
      content: (
        <WorkOrdersTabContent
          contextType={ContextType.ParkingSpace}
          id={parkingSpace.rentalId}
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
