import type { ReactNode } from 'react'
import type { RentalPropertyInfo } from '@onecore/types'
import { SegmentedTabs, useRouteTab } from '@onecore/ui'

import {
  TenantCommunicationTabContent,
  TenantKeyLoans,
  TenantLeasesTabContent,
  TenantLedgerTabContent,
  TenantNotesTabContent,
  TenantQueueSystemTabContent,
  TenantRelatedContactsTabContent,
} from '@/features/tenants'
import { WorkOrdersTabContent } from '@/features/work-orders'

import { Lease } from '@/services/api/core/leaseService'

import { useIsMobile } from '@/shared/hooks/useMobile'
import { ContextType } from '@/shared/types/ui'
import { TabsAccordion } from '@/shared/ui/TabsAccordion'

import { TENANT_DEFAULT_TAB, TENANT_TABS, type TenantTab } from '../model/tabs'

interface TenantTabsProps {
  leases: Lease[]
  rentalProperties: Record<string, RentalPropertyInfo | null>
  contactCode: string
  tenantName: string
  nationalRegistrationNumber: string
  isLoadingLeases: boolean
  isLoadingProperties: boolean
}

export const TenantTabs = ({
  leases,
  rentalProperties,
  contactCode,
  nationalRegistrationNumber,
  isLoadingLeases,
  isLoadingProperties,
}: TenantTabsProps) => {
  const isMobile = useIsMobile()
  const { value, basePath } = useRouteTab(TENANT_TABS, TENANT_DEFAULT_TAB)

  const content: Record<TenantTab, ReactNode> = {
    hyreskontrakt: (
      <TenantLeasesTabContent
        leases={leases}
        rentalProperties={rentalProperties}
        isLoadingLeases={isLoadingLeases}
        isLoadingProperties={isLoadingProperties}
      />
    ),
    uthyrning: <TenantQueueSystemTabContent contactCode={contactCode} />,
    arenden: (
      <WorkOrdersTabContent id={contactCode} contextType={ContextType.Tenant} />
    ),
    fakturor: (
      <TenantLedgerTabContent
        contactCode={contactCode}
        nationalRegistrationNumber={nationalRegistrationNumber}
      />
    ),
    noteringar: <TenantNotesTabContent contactCode={contactCode} />,
    kommunikation: <TenantCommunicationTabContent contactCode={contactCode} />,
    nyckellan: <TenantKeyLoans contactCode={contactCode} leases={leases} />,
    kontakter: <TenantRelatedContactsTabContent contactCode={contactCode} />,
  }

  if (isMobile) {
    return <TabsAccordion tabs={TENANT_TABS} content={content} open={value} />
  }

  return (
    <div className="w-full">
      <SegmentedTabs
        tabs={TENANT_TABS}
        value={value}
        basePath={basePath}
        className="mb-4"
      />
      {content[value]}
    </div>
  )
}
