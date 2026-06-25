import type { RentalPropertyInfo } from '@onecore/types'
import {
  FileText,
  Home,
  Key,
  MessageSquare,
  Receipt,
  StickyNote,
  Users,
} from 'lucide-react'

import {
  TenantKeyLoans,
  TenantLeasesTabContent,
  TenantLedgerTabContent,
  TenantNotesTabContent,
  TenantQueueSystemTabContent,
  TenantRelatedContactsTabContent,
} from '@/features/tenants'
import { WorkOrdersTabContent } from '@/features/work-orders'

import { Lease } from '@/services/api/core/leaseService'

import { ContextType } from '@/shared/types/ui'
import {
  MobileAccordion,
  MobileAccordionItem,
} from '@/shared/ui/MobileAccordion'

interface TenantTabsMobileProps {
  leases: Lease[]
  rentalProperties: Record<string, RentalPropertyInfo | null>
  contactCode: string
  tenantName: string
  nationalRegistrationNumber: string
  isLoadingLeases: boolean
  isLoadingProperties: boolean
}

export const TenantTabsMobile = ({
  leases,
  rentalProperties,
  contactCode,
  tenantName,
  nationalRegistrationNumber,
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
      content: (
        <TenantLedgerTabContent
          contactCode={contactCode}
          nationalRegistrationNumber={nationalRegistrationNumber}
        />
      ),
    },
    {
      id: 'notes',
      icon: StickyNote,
      title: 'Noteringar',
      content: <TenantNotesTabContent contactCode={contactCode} />,
    },
    {
      id: 'keys',
      icon: Key,
      title: 'Nyckellån',
      content: <TenantKeyLoans contactCode={contactCode} leases={leases} />,
    },
    {
      id: 'related',
      icon: Users,
      title: 'Relaterade kontakter',
      content: <TenantRelatedContactsTabContent contactCode={contactCode} />,
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
