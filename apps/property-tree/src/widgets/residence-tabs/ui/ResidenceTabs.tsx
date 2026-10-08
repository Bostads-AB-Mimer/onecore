import type { ReactNode } from 'react'
import { SegmentedTabs, useRouteTab } from '@onecore/ui'

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

import { useIsMobile } from '@/shared/hooks/useMobile'
import { ContextType } from '@/shared/types/ui'

import {
  RESIDENCE_DEFAULT_TAB,
  RESIDENCE_TABS,
  type ResidenceTab,
} from '../model/tabs'
import { ResidenceTabsMobile } from './ResidenceTabsMobile'
import { RoomsTabContent } from './RoomsTabContent'

type Residence = components['schemas']['ResidenceDetails']

interface ResidenceTabsProps {
  residence: Residence
  currentLease?: Lease
  leasesIsLoading: boolean
  leasesError: Error | null
}

export const ResidenceTabs = ({
  residence,
  currentLease,
  leasesIsLoading,
  leasesError,
}: ResidenceTabsProps) => {
  const isMobile = useIsMobile()
  const { value, basePath } = useRouteTab(RESIDENCE_TABS, RESIDENCE_DEFAULT_TAB)
  const rentalId = residence.propertyObject.rentalId ?? ''

  if (isMobile) {
    return (
      <ResidenceTabsMobile
        residence={residence}
        currentLease={currentLease}
        leasesIsLoading={leasesIsLoading}
        leasesError={leasesError}
      />
    )
  }

  const content: Record<ResidenceTab, ReactNode> = {
    rum: rentalId ? <RoomsTabContent rentalId={rentalId} /> : null,
    bofaktablad: <ResidenceFloorplanTabsContent rentalId={rentalId} />,
    besiktningar: (
      <InspectionsTabContent
        rentalId={residence.propertyObject.rentalId ?? undefined}
        residence={residence}
      />
    ),
    hyresgast: (
      <TenantsTabContent
        isLoading={leasesIsLoading}
        error={leasesError}
        lease={currentLease}
      />
    ),
    kontrakt: <LeasesTabContent rentalPropertyId={rentalId} />,
    hyresrader: rentalId && (
      <RentRowsTabContent rentalObjectCode={rentalId} lease={currentLease} />
    ),
    nycklar: rentalId && <RentalObjectKeys rentalObjectCode={rentalId} />,
    arenden: rentalId && (
      <WorkOrdersTabContent contextType={ContextType.Residence} id={rentalId} />
    ),
    dokument: (
      <DocumentsTabContent
        contextType={ContextType.Residence}
        id={residence.id}
      />
    ),
    sparrar: <RentalBlocksTabContent rentalId={rentalId} />,
    underhallsenheter: (
      <MaintenanceUnitsTabContent
        contextType="residence"
        identifier={rentalId || undefined}
        showFlatList
      />
    ),
  }

  return (
    <div className="w-full">
      <SegmentedTabs
        tabs={RESIDENCE_TABS}
        value={value}
        basePath={basePath}
        className="mb-4"
      />
      {content[value]}
    </div>
  )
}
