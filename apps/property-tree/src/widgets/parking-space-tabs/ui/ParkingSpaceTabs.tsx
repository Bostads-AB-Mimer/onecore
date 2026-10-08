import type { ReactNode } from 'react'
import { SegmentedTabs, useRouteTab } from '@onecore/ui'

import { LeasesTabContent } from '@/features/leases'
import { RentRowsTabContent } from '@/features/rent-rows'
import { CurrentTenant } from '@/features/tenants'
import { WorkOrdersTabContent } from '@/features/work-orders'

import { components } from '@/services/api/core/generated/api-types'
import { Lease } from '@/services/api/core/leaseService'

import { useIsMobile } from '@/shared/hooks/useMobile'
import { ContextType } from '@/shared/types/ui'

import {
  PARKING_SPACE_DEFAULT_TAB,
  PARKING_SPACE_TABS,
  type ParkingSpaceTab,
} from '../model/tabs'
import { ParkingSpaceTabsMobile } from './ParkingSpaceTabsMobile'

type ParkingSpace = components['schemas']['ParkingSpace']

interface ParkingSpaceTabsProps {
  parkingSpace: ParkingSpace
  leases?: Lease[]
  leasesIsLoading: boolean
  currentLease?: Lease
}

export function ParkingSpaceTabs({
  parkingSpace,
  leases,
  leasesIsLoading,
  currentLease,
}: ParkingSpaceTabsProps) {
  const isMobile = useIsMobile()
  const { value, basePath } = useRouteTab(
    PARKING_SPACE_TABS,
    PARKING_SPACE_DEFAULT_TAB
  )

  if (isMobile) {
    return (
      <ParkingSpaceTabsMobile
        parkingSpace={parkingSpace}
        leases={leases}
        leasesIsLoading={leasesIsLoading}
        currentLease={currentLease}
      />
    )
  }

  const content: Record<ParkingSpaceTab, ReactNode> = {
    hyresgast: (
      <CurrentTenant
        rentalPropertyId={parkingSpace.rentalId}
        leases={leases}
        isLoading={leasesIsLoading}
      />
    ),
    kontrakt: <LeasesTabContent rentalPropertyId={parkingSpace.rentalId} />,
    hyresrader: (
      <RentRowsTabContent
        rentalObjectCode={parkingSpace.rentalId}
        lease={currentLease}
      />
    ),
    besiktningar: null,
    arenden: (
      <WorkOrdersTabContent
        contextType={ContextType.ParkingSpace}
        id={parkingSpace.rentalId}
      />
    ),
  }

  return (
    <div className="w-full">
      <SegmentedTabs
        tabs={PARKING_SPACE_TABS}
        value={value}
        basePath={basePath}
        className="mb-4"
      />
      {content[value]}
    </div>
  )
}
