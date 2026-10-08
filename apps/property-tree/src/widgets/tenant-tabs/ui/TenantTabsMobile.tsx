import type { RentalPropertyInfo } from '@onecore/types'
import { useRouteTab } from '@onecore/ui'
import {
  FileText,
  Home,
  Key,
  Mail,
  MessageSquare,
  Receipt,
  StickyNote,
  Users,
} from 'lucide-react'

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

import { ContextType } from '@/shared/types/ui'
import {
  MobileAccordion,
  MobileAccordionItem,
} from '@/shared/ui/MobileAccordion'

import { TENANT_DEFAULT_TAB, TENANT_TABS } from '../model/tabs'

interface TenantTabsMobileProps {
  leases: Lease[]
  rentalProperties: Record<string, RentalPropertyInfo | null>
  contactCode: string
  nationalRegistrationNumber: string
  isLoadingLeases: boolean
  isLoadingProperties: boolean
}

export const TenantTabsMobile = ({
  leases,
  rentalProperties,
  contactCode,
  nationalRegistrationNumber,
  isLoadingLeases,
  isLoadingProperties,
}: TenantTabsMobileProps) => {
  const { value } = useRouteTab(TENANT_TABS, TENANT_DEFAULT_TAB)

  const accordionItems: MobileAccordionItem[] = [
    {
      id: 'hyreskontrakt',
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
      id: 'uthyrning',
      icon: Home,
      title: 'Uthyrning',
      content: <TenantQueueSystemTabContent contactCode={contactCode} />,
    },
    {
      id: 'arenden',
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
      id: 'fakturor',
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
      id: 'noteringar',
      icon: StickyNote,
      title: 'Noteringar',
      content: <TenantNotesTabContent contactCode={contactCode} />,
    },
    {
      id: 'kommunikation',
      icon: Mail,
      title: 'Kommunikationslogg',
      content: <TenantCommunicationTabContent contactCode={contactCode} />,
    },
    {
      id: 'nyckellan',
      icon: Key,
      title: 'Nyckellån',
      content: <TenantKeyLoans contactCode={contactCode} leases={leases} />,
    },
    {
      id: 'kontakter',
      icon: Users,
      title: 'Relaterade kontakter',
      content: <TenantRelatedContactsTabContent contactCode={contactCode} />,
    },
  ]

  return (
    <MobileAccordion
      items={accordionItems}
      defaultOpen={[value]}
      className="space-y-3"
    />
  )
}
