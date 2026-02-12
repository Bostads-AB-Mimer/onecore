import {
  FileText,
  Home,
  MessageSquare,
  Receipt,
  StickyNote,
} from 'lucide-react'

import {
  MobileAccordion,
  MobileAccordionItem,
} from '@/shared/ui/MobileAccordion'

import { Lease } from '@/services/api/core/leaseService'
import type { RentalPropertyInfo } from '@onecore/types'
import { ContextType } from '@/shared/types/ui'

import {
  TenantLeasesTabContent,
  TenantQueueSystemTabContent,
  TenantNotesTabContent,
  TenantLedgerTabContent,
} from '@/features/tenants'
import { WorkOrdersTabContent } from '@/features/work-orders'

interface TenantTabsMobileProps {
  leases: Lease[]
  rentalProperties: Record<string, RentalPropertyInfo | null>
  contactCode: string
  tenantName: string
  isLoadingLeases: boolean
  isLoadingProperties: boolean
}

export const TenantTabsMobile = ({
  leases,
  rentalProperties,
  contactCode,
  tenantName,
  isLoadingLeases,
  isLoadingProperties,
}: TenantTabsMobileProps) => {
  const accordionItems: MobileAccordionItem[] = [
    {
      id: 'contracts',
      icon: FileText,
      title: 'Hyreskontrakt',
      content: (
        <TenantLeasesTabContent
          leases={leases}
          rentalProperties={rentalProperties}
          isLoadingLeases={isLoadingLeases}
          isLoadingProperties={isLoadingProperties}
        />
      ),
    },
    {
      id: 'queue',
      icon: Home,
      title: 'Uthyrning',
      content: (
        <TenantQueueSystemTabContent
          contactCode={contactCode}
          tenantName={tenantName}
        />
      ),
    },
    {
      id: 'work-orders',
      icon: MessageSquare,
      title: 'Ärenden',
      content: (
        <WorkOrdersTabContent
          id={contactCode}
          contextType={ContextType.Tenant}
        />
      ),
    },
    {
      id: 'ledger',
      icon: Receipt,
      title: 'Fakturor & betalningar',
      content: <TenantLedgerTabContent contactCode={contactCode} />,
    },
    {
      id: 'notes',
      icon: StickyNote,
      title: 'Noteringar',
      content: <TenantNotesTabContent contactCode={contactCode} />,
    },
  ]

  return (
    <MobileAccordion
      items={accordionItems}
      defaultOpen={['contracts']}
      className="space-y-3"
    />
  )
}
