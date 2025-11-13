// import { TenantContracts } from './TenantContracts'
import { TenantQueueSystem } from './TenantQueueSystem'
// import { TenantNotes } from './TenantNotes'
// import { TenantOrders } from './TenantOrders'
// import { TenantLedger } from './TenantLedger'
import {
  MobileAccordion as GenericMobileAccordion,
  MobileAccordionItem,
} from '@/components/ui/MobileAccordion'
// import { getMockLedgerForCustomer } from '@/data/ledger'
// import { getMockInvoicesForCustomer } from '@/data/invoices'

interface TenantMobileAccordionProps {
  hasActiveCases?: boolean
  contactCode: string
  customerName: string
}

export function TenantMobileAccordion({
  hasActiveCases,
  contactCode,
  customerName,
}: TenantMobileAccordionProps) {
  const accordionItems: MobileAccordionItem[] = [
    {
      id: 'contracts',
      title: 'Hyreskontrakt',
      content: <div>Placeholder Hyreskontrakt</div>,
      // content: <TenantContracts contracts={contracts} />,
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
  ]

  return (
    <GenericMobileAccordion
      items={accordionItems}
      defaultOpen={['contracts']}
      className="space-y-3"
    />
  )
}
