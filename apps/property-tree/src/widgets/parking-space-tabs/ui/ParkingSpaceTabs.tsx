import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/v2/Tabs'
import { ClipboardList, Users, MessageSquare, FileText } from 'lucide-react'

import { useIsMobile } from '@/hooks/useMobile'
import { components } from '@/services/api/core/generated/api-types'
import { Lease } from '@/services/api/core/lease-service'
import { ContextType } from '@/types/ui'

import { CurrentTenant } from '@/features/tenants'
import { LeasesTabContent } from '@/features/leases'
import { WorkOrdersTabContent } from '@/features/work-orders'

import { ParkingSpaceTabsMobile } from './ParkingSpaceTabsMobile'

type ParkingSpace = components['schemas']['ParkingSpace']

interface ParkingSpaceTabsProps {
  parkingSpace: ParkingSpace
  leases?: Lease[]
  leasesIsLoading: boolean
}

export function ParkingSpaceTabs({
  parkingSpace,
  leases,
  leasesIsLoading,
}: ParkingSpaceTabsProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <ParkingSpaceTabsMobile
        parkingSpace={parkingSpace}
        leases={leases}
        leasesIsLoading={leasesIsLoading}
      />
    )
  }

  return (
    <Tabs defaultValue="tenant" className="w-full">
      <TabsList className="mb-4 bg-slate-100/70 p-1 rounded-lg">
        <TabsTrigger value="tenant" className="flex items-center gap-1.5">
          <Users className="h-4 w-4" />
          <span className="hidden sm:inline">Hyresgäst</span>
        </TabsTrigger>
        <TabsTrigger value="leases" className="flex items-center gap-1.5">
          <FileText className="h-4 w-4" />
          <span className="hidden sm:inline">Kontrakt</span>
        </TabsTrigger>
        <TabsTrigger
          value="inspections"
          className="flex items-center gap-1.5"
          disabled
        >
          <ClipboardList className="h-4 w-4" />
          <span className="hidden sm:inline">Besiktningar</span>
        </TabsTrigger>
        <TabsTrigger value="work-orders" className="flex items-center gap-1.5">
          <MessageSquare className="h-4 w-4" />
          <span className="hidden sm:inline">Ärenden</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="tenant">
        <CurrentTenant
          rentalPropertyId={parkingSpace.rentalId}
          leases={leases}
          isLoading={leasesIsLoading}
        />
      </TabsContent>

      <TabsContent value="leases">
        <LeasesTabContent rentalPropertyId={parkingSpace.rentalId} />
      </TabsContent>

      <TabsContent value="work-orders">
        <WorkOrdersTabContent
          contextType={ContextType.Residence}
          id={parkingSpace.rentalId}
        />
      </TabsContent>
    </Tabs>
  )
}
