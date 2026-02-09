import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/v2/Tabs'
import {
  ClipboardList,
  Users,
  MessageSquare,
  FileText,
  Wrench,
  Info,
} from 'lucide-react'

import { useIsMobile } from '@/hooks/useMobile'
import { components } from '@/services/api/core/generated/api-types'
import { Lease } from '@/services/api/core/lease-service'
import { ContextType } from '@/types/ui'

import { FacilityComponents } from '@/features/facilities'
import { CurrentTenant } from '@/features/tenants'
import { LeasesTabContent } from '@/features/leases'
import { WorkOrdersTabContent } from '@/features/work-orders'
import { ResidenceRoomsTabContent } from '@/features/rooms'

import { FacilityTabsMobile } from './FacilityTabsMobile'

type Facility = components['schemas']['FacilityDetails']

interface FacilityTabsProps {
  facility: Facility
  leases?: Lease[]
  leasesIsLoading: boolean
}

export function FacilityTabs({
  facility,
  leases,
  leasesIsLoading,
}: FacilityTabsProps) {
  const isMobile = useIsMobile()
  const rentalId = facility.rentalInformation?.rentalId

  if (isMobile) {
    return (
      <FacilityTabsMobile
        facility={facility}
        leases={leases}
        leasesIsLoading={leasesIsLoading}
      />
    )
  }

  return (
    <Tabs defaultValue="components" className="w-full">
      <TabsList className="mb-4 bg-slate-100/70 p-1 rounded-lg">
        <TabsTrigger value="components" className="flex items-center gap-1.5">
          <Wrench className="h-4 w-4" />
          <span className="hidden sm:inline">Komponenter</span>
        </TabsTrigger>
        <TabsTrigger value="rooms" className="flex items-center gap-1.5">
          <Info className="h-4 w-4" />
          <span className="hidden sm:inline">Rumsinformation</span>
        </TabsTrigger>
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

      <TabsContent value="components">
        <FacilityComponents
          propertyObjectId={facility.propertyObjectId}
          facilityName={facility.name || facility.code}
        />
      </TabsContent>

      <TabsContent value="rooms">
        <ResidenceRoomsTabContent facilityId={facility.id} />
      </TabsContent>

      <TabsContent value="tenant">
        {rentalId && (
          <CurrentTenant
            rentalPropertyId={rentalId}
            leases={leases}
            isLoading={leasesIsLoading}
          />
        )}
      </TabsContent>

      <TabsContent value="leases">
        {rentalId && <LeasesTabContent rentalPropertyId={rentalId} />}
      </TabsContent>

      <TabsContent value="work-orders">
        {rentalId && (
          <WorkOrdersTabContent
            contextType={ContextType.Residence}
            id={rentalId}
          />
        )}
      </TabsContent>
    </Tabs>
  )
}
