import { TabsContent } from '@/components/ui/v2/Tabs'
import { WorkOrdersManagement } from '@/components/work-orders/WorkOrdersManagement'
// import { TenantContracts } from '@/components/tenants/TenantContracts'
// import { TenantQueueSystem } from '@/components/tenants/TenantQueueSystem'
// import { TenantNotes } from '@/components/tenants/TenantNotes'
// import { TenantOrders } from '@/components/tenants/TenantOrders'
// import { TenantEventLog } from '@/components/tenants/TenantEventLog'
// import { TenantDocuments } from '@/components/tenants/TenantDocuments'
// import { TenantLedger } from '@/components/tenants/TenantLedger'
// import { TenantKeys } from '@/components/tenants/TenantKeys'
import { StickyNote } from 'lucide-react'
// import { getMockLedgerForCustomer } from '@/data/ledger'
// import { getMockInvoicesForCustomer } from '@/data/invoices'

interface TenantDetailTabsContentProps {
  contracts: any[]
  personalNumber?: string
  contactCode: string
  customerName: string
}

export const TenantDetailTabsContent = ({
  contracts,
  personalNumber,
  contactCode,
  customerName,
}: TenantDetailTabsContentProps) => {
  return (
    <>
      <TabsContent value="contracts">
        <div>Placeholder Hyreskontrakt</div>
        {/* <TenantContracts contracts={contracts} /> */}
      </TabsContent>

      <TabsContent value="queue">
        <div>Placeholder Kösystem</div>
        {/* <TenantQueueSystem
          customerNumber={contactCode}
          customerName={customerName}
        /> */}
      </TabsContent>

      <TabsContent value="cases">
        <WorkOrdersManagement id={contactCode} contextType="tenant" />
      </TabsContent>

      <TabsContent value="ledger">
        <div>Placeholder Fakturor & betalningar</div>
        {/* <TenantLedger
          ledger={getMockLedgerForCustomer(personalNumber || customerNumber)}
          invoices={getMockInvoicesForCustomer(
            personalNumber || customerNumber
          )}
        /> */}
      </TabsContent>

      <TabsContent value="notes">
        <div>Placeholder Noteringar</div>
        {/* <TenantNotes /> */}
      </TabsContent>

      <TabsContent value="keys">
        <div>Placeholder Nyckelknippa</div>
        {/* <TenantKeys /> */}
      </TabsContent>

      <TabsContent value="events">
        <div>Placeholder Händelselogg</div>
        {/* <TenantEventLog personalNumber={personalNumber || ''} /> */}
      </TabsContent>

      <TabsContent value="documents">
        <div>Placeholder Dokument</div>
        {/* <TenantDocuments /> */}
      </TabsContent>
    </>
  )
}
