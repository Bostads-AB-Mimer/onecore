import { parseAsString, useQueryState } from 'nuqs'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/Tabs'
import {
  FileText,
  Home,
  MessageSquare,
  Receipt,
  StickyNote,
} from 'lucide-react'

import { useIsMobile } from '@/shared/hooks/useMobile'
import { Lease } from '@/services/api/core/lease-service'
import type { RentalPropertyInfo } from '@onecore/types'
import { ContextType } from '@/shared/types/ui'

import {
  TenantLeasesTabContent,
  TenantQueueSystemTabContent,
  TenantNotesTabContent,
  TenantLedgerTabContent,
} from '@/features/tenants'
import { WorkOrdersTabContent } from '@/features/work-orders'

import { TenantTabsMobile } from './TenantTabsMobile'

interface TenantTabsProps {
  leases: Lease[]
  rentalProperties: Record<string, RentalPropertyInfo | null>
  contactCode: string
  tenantName: string
  isLoadingLeases: boolean
  isLoadingProperties: boolean
}

export const TenantTabs = ({
  leases,
  rentalProperties,
  contactCode,
  tenantName,
  isLoadingLeases,
  isLoadingProperties,
}: TenantTabsProps) => {
  const isMobile = useIsMobile()
  const [tab, setTab] = useQueryState(
    'tab',
    parseAsString.withDefault('contracts')
  )

  if (isMobile) {
    return (
      <TenantTabsMobile
        leases={leases}
        rentalProperties={rentalProperties}
        contactCode={contactCode}
        tenantName={tenantName}
        isLoadingLeases={isLoadingLeases}
        isLoadingProperties={isLoadingProperties}
      />
    )
  }

  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <TabsList className="mb-4 bg-slate-100/70 p-1 rounded-lg">
        <TabsTrigger value="contracts" className="flex items-center gap-1.5">
          <FileText className="h-4 w-4" />
          <span className="hidden sm:inline">Hyreskontrakt</span>
        </TabsTrigger>
        <TabsTrigger value="queue" className="flex items-center gap-1.5">
          <Home className="h-4 w-4" />
          <span className="hidden sm:inline">Uthyrning</span>
        </TabsTrigger>
        <TabsTrigger value="work-orders" className="flex items-center gap-1.5">
          <MessageSquare className="h-4 w-4" />
          <span className="hidden sm:inline">Ärenden</span>
        </TabsTrigger>
        <TabsTrigger value="ledger" className="flex items-center gap-1.5">
          <Receipt className="h-4 w-4" />
          <span className="hidden sm:inline">Fakturor & betalningar</span>
        </TabsTrigger>
        <TabsTrigger value="notes" className="flex items-center gap-1.5">
          <StickyNote className="h-4 w-4" />
          <span className="hidden sm:inline">Noteringar</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="contracts">
        <TenantLeasesTabContent
          leases={leases}
          rentalProperties={rentalProperties}
          isLoadingLeases={isLoadingLeases}
          isLoadingProperties={isLoadingProperties}
        />
      </TabsContent>

      <TabsContent value="queue">
        <TenantQueueSystemTabContent
          contactCode={contactCode}
          tenantName={tenantName}
        />
      </TabsContent>

      <TabsContent value="work-orders">
        <WorkOrdersTabContent
          id={contactCode}
          contextType={ContextType.Tenant}
        />
      </TabsContent>

      <TabsContent value="ledger">
        <TenantLedgerTabContent contactCode={contactCode} />
      </TabsContent>

      <TabsContent value="notes">
        <TenantNotesTabContent contactCode={contactCode} />
      </TabsContent>
    </Tabs>
  )
}
