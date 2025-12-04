import { TenantQueueSystem } from './TenantQueueSystem'
import { TenantContracts } from '@/components/tenants/TenantContracts'
// import { TenantNotes } from './TenantNotes'
// import { TenantOrders } from './TenantOrders'
// import { TenantLedger } from './TenantLedger'
import {
  MobileAccordion as GenericMobileAccordion,
  MobileAccordionItem,
} from '@/components/ui/MobileAccordion'
import { Lease } from '@/services/api/core/lease-service'
import type { RentalPropertyInfo } from '@onecore/types'

interface TenantMobileAccordionProps {
  leases: Lease[]
  rentalProperties: Record<string, RentalPropertyInfo>
  hasActiveCases?: boolean
  contactCode: string
  customerName: string
}

export function TenantMobileAccordion({
  leases: contracts,
  rentalProperties,
  hasActiveCases,
  contactCode,
  customerName,
}: TenantMobileAccordionProps) {
  const accordionItems: MobileAccordionItem[] = [
    {
      id: 'contracts',
      title: 'Hyreskontrakt',
      content: (
        <TenantContracts
          leases={contracts}
          rentalProperties={rentalProperties}
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
      title: hasActiveCases ? `Ärenden (2)` : 'Ärenden',
      content: <div>Placeholder Ärenden</div>,
      // content: <TenantOrders />,
    },
    {
      id: 'ledger',
      title: 'Fakturor & betalningar',
      content: <div>Placeholder Fakturor & betalningar</div>,
      // content: (
      //   <TenantLedger
      //     ledger={getMockLedgerForCustomer(customerNumber)}
      //     invoices={getMockInvoicesForCustomer(customerNumber)}
      //   />
      // ),
    },
    /*
    {
      id: 'notes',
      title: 'Noteringar',
      content: <div>Placeholder Noteringar</div>,
      // content: <TenantNotes />,
    },
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
