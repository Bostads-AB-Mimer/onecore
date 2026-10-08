import type { ReactNode } from 'react'
import { SegmentedTabs, useRouteTab } from '@onecore/ui'

import { SpaceComponents } from '@/features/component-library'
import { LeasesTabContent } from '@/features/leases'
import { RentRowsTabContent } from '@/features/rent-rows'
import { CurrentTenant } from '@/features/tenants'
import { WorkOrdersTabContent } from '@/features/work-orders'

import { components } from '@/services/api/core/generated/api-types'
import { Lease } from '@/services/api/core/leaseService'

import { useIsMobile } from '@/shared/hooks/useMobile'
import { ContextType } from '@/shared/types/ui'
import { TabsAccordion } from '@/shared/ui/TabsAccordion'

import {
  FACILITY_DEFAULT_TAB,
  FACILITY_TABS,
  type FacilityTab,
} from '../model/tabs'
import { RoomsTabContent } from './RoomsTabContent'

type Facility = components['schemas']['FacilityDetails']

interface FacilityTabsProps {
  facility: Facility
  leases?: Lease[]
  leasesIsLoading: boolean
  currentLease?: Lease
}

export function FacilityTabs({
  facility,
  leases,
  leasesIsLoading,
  currentLease,
}: FacilityTabsProps) {
  const isMobile = useIsMobile()
  const { value, basePath } = useRouteTab(FACILITY_TABS, FACILITY_DEFAULT_TAB)
  const rentalId = facility.rentalInformation?.rentalId

  const content: Record<FacilityTab, ReactNode> = {
    komponenter: (
      <SpaceComponents
        spaceId={facility.propertyObjectId}
        spaceName={facility.name || facility.code}
      />
    ),
    rum: <RoomsTabContent facilityId={facility.id} />,
    hyresgast: rentalId && (
      <CurrentTenant
        rentalPropertyId={rentalId}
        leases={leases}
        isLoading={leasesIsLoading}
      />
    ),
    kontrakt: rentalId && <LeasesTabContent rentalPropertyId={rentalId} />,
    hyresrader: rentalId && (
      <RentRowsTabContent rentalObjectCode={rentalId} lease={currentLease} />
    ),
    besiktningar: null,
    arenden: rentalId && (
      <WorkOrdersTabContent contextType={ContextType.Facility} id={rentalId} />
    ),
  }

  if (isMobile) {
    return <TabsAccordion tabs={FACILITY_TABS} content={content} open={value} />
  }

  return (
    <div className="w-full">
      <SegmentedTabs
        tabs={FACILITY_TABS}
        value={value}
        basePath={basePath}
        className="mb-4"
      />
      {content[value]}
    </div>
  )
}
