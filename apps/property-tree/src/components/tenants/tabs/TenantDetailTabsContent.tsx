import { TabsContent } from '@/components/ui/v2/Tabs'
import {
  ContextType,
  WorkOrdersManagement,
} from '@/components/work-orders/WorkOrdersManagement'
import { TenantQueueSystem } from '@/components/tenants/TenantQueueSystem'
import { TenantContracts } from '@/components/tenants/TenantContracts'
import { TenantNotes } from '@/components/tenants/TenantNotes'
// import { TenantOrders } from '@/components/tenants/TenantOrders'
// import { TenantEventLog } from '@/components/tenants/TenantEventLog'
// import { TenantDocuments } from '@/components/tenants/TenantDocuments'
// import { TenantLedger } from '@/components/tenants/TenantLedger'
// import { TenantKeys } from '@/components/tenants/TenantKeys'
import { StickyNote } from 'lucide-react'

import { Lease } from '@/services/api/core/lease-service'
import type { RentalPropertyInfo } from '@onecore/types'
import { TenantLedger } from '../TenantLedger'

interface TenantDetailTabsContentProps {
  leases: Lease[]
  rentalProperties: Record<string, RentalPropertyInfo | null>
  personalNumber?: string
  contactCode: string
  customerName: string
  isLoadingLeases?: boolean
  isLoadingProperties?: boolean
}

export const TenantDetailTabsContent = ({
  leases,
  rentalProperties,
  personalNumber,
  contactCode,
  customerName,
  isLoadingLeases = false,
  isLoadingProperties = false,
}: TenantDetailTabsContentProps) => {
  return (
    <>
      <TabsContent value="contracts">
        <TenantContracts
          leases={leases}
          rentalProperties={rentalProperties}
          isLoadingLeases={isLoadingLeases}
          isLoadingProperties={isLoadingProperties}
        />
      </TabsContent>

      <TabsContent value="queue">
        <TenantQueueSystem
          customerNumber={contactCode}
          customerName={customerName}
        />
      </TabsContent>

      <TabsContent value="work-orders">
        <WorkOrdersManagement
          id={contactCode}
          contextType={ContextType.Tenant}
        />
      </TabsContent>

      <TabsContent value="ledger">
        <TenantLedger contactCode={contactCode} />
      </TabsContent>

      <TabsContent value="notes">
        <TenantNotes contactCode={contactCode} />
      </TabsContent>

      {/*
      <TabsContent value="keys">
        <div>Placeholder Nyckelknippa</div>
      </TabsContent>

      <TabsContent value="events">
        <div>Placeholder Händelselogg</div>
      </TabsContent>

      <TabsContent value="documents">
        <div>Placeholder Dokument</div>
      </TabsContent>
      */}
    </>
  )
}
