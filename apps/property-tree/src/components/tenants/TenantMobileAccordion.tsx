import { TenantQueueSystem } from './TenantQueueSystem'
import { TenantContracts } from '@/components/tenants/TenantContracts'
import { TenantNotes } from './TenantNotes'
// import { TenantOrders } from './TenantOrders'
import { TenantLedger } from './TenantLedger'
import {
  MobileAccordion as GenericMobileAccordion,
  MobileAccordionItem,
} from '@/components/ui/MobileAccordion'
import { Lease } from '@/services/api/core/lease-service'
import type { RentalPropertyInfo } from '@onecore/types'
import { WorkOrdersManagement } from '../work-orders/WorkOrdersManagement'
import { ContextType } from '@/types/ui'

interface TenantMobileAccordionProps {
  leases: Lease[]
  rentalProperties: Record<string, RentalPropertyInfo | null>
  hasActiveCases?: boolean
  contactCode: string
  customerName: string
  isLoadingLeases?: boolean
  isLoadingProperties?: boolean
}

export function TenantMobileAccordion({
  leases: contracts,
  rentalProperties,
  hasActiveCases,
  contactCode,
  customerName,
  isLoadingLeases = false,
  isLoadingProperties = false,
}: TenantMobileAccordionProps) {
  const accordionItems: MobileAccordionItem[] = [
    {
      id: 'contracts',
      title: 'Hyreskontrakt',
      content: (
        <TenantContracts
          leases={contracts}
          rentalProperties={rentalProperties}
          isLoadingLeases={isLoadingLeases}
          isLoadingProperties={isLoadingProperties}
        />
      ),
    },
    {
      id: 'queue',
      title: 'Uthyrning',
      content: (
        <TenantQueueSystem
          customerNumber={contactCode}
          customerName={customerName}
        />
      ),
    },
    {
      id: 'cases',
      title: 'Ärenden',
      content: (
        <WorkOrdersManagement
          id={contactCode}
          contextType={ContextType.Tenant}
        />
      ),
    },
    {
      id: 'ledger',
      title: 'Fakturor & betalningar',
      content: <TenantLedger contactCode={contactCode} />,
    },
    {
      id: 'notes',
      title: 'Noteringar',
      content: <TenantNotes contactCode={contactCode} />,
    },
    /*
    
    {
      id: 'keys',
      title: 'Nyckelknippa',
      content: <div>Placeholder Nyckelknippa</div>,
      // content: <TenantKeys />,
    },
    {
      id: 'events',
      title: 'Händelselogg',
      content: <div>Placeholder Händelselogg</div>,
      // content: <TenantEventLog personalNumber={personalNumber || ''} />,
    },
    {
      id: 'documents',
      title: 'Dokument',
      content: <div>Placeholder Dokument</div>,
      // content: <TenantDocuments />,
    },
    */
  ]

  return (
    <GenericMobileAccordion
      items={accordionItems}
      defaultOpen={['contracts']}
      className="space-y-3"
    />
  )
}
